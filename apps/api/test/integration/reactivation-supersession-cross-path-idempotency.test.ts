/**
 * HOS-123 T-017 — Cross-path idempotency (OQ-5, spec §8 bullet 6).
 *
 * Real-PostgreSQL integration coverage for `completeSupersessionPairing`
 * (`apps/api/src/services/billing/reactivation-supersession-complete.ts`),
 * which is now reachable from TWO independent webhook entry points:
 *
 * - the monthly preapproval-confirm path
 *   (`routes/webhooks/mercadopago/subscription-logic.ts`, triggered on
 *   `subscription_preapproval.created`), and
 * - the annual payment-confirm path
 *   (`routes/webhooks/mercadopago/payment-logic.ts::confirmAnnualSubscription`,
 *   triggered on `payment.updated`, wired in HOS-123 T-013).
 *
 * Both call the SAME shared function for the SAME `(newSubscriptionId,
 * supersededId)` pairing in a retry-storm scenario (e.g. MercadoPago
 * redelivers a webhook, or the reconcile cron races a webhook delivery).
 * This suite proves the pairing can never be double-completed:
 *
 * 1. Sequential cross-path call (the realistic retry-storm timing — webhook
 *    deliveries never truly overlap at the SQL-statement level): the second
 *    call must no-op via the application-level idempotency guard (Step 1's
 *    SELECT), never re-invoking `billing.subscriptions.cancel()`.
 * 2. The DB-level backstop itself: the partial unique index
 *    `uq_billing_subscription_events_supersession_pairing`
 *    (`packages/db/src/migrations/extras/029-hos114-supersession-audit-unique.index.sql`)
 *    on `(subscription_id, metadata->>'supersededSubscriptionId')` is
 *    exercised directly (bypassing the application-level guard) to prove
 *    the constraint itself — not just the application code that normally
 *    relies on it — silently rejects (`onConflictDoNothing`) a genuine
 *    duplicate row for the identical pairing. This is the guarantee that
 *    still holds even in a true concurrent race where both callers pass the
 *    Step 1 SELECT before either INSERT commits.
 *
 * These tests are skipped if `HOSPEDA_DATABASE_URL` is not available (same
 * convention as `subscription-lifecycle-smoke.test.ts`).
 *
 * The existing mocked-DB unit suite
 * (`test/services/billing/reactivation-supersession-complete.test.ts`)
 * already covers the idempotency guard's branching logic against a FAKE db
 * — it cannot prove the real unique index exists and works. This suite is
 * the real-DB complement, not a duplicate.
 *
 * @module test/integration/reactivation-supersession-cross-path-idempotency
 */

import {
    and,
    billingCustomers,
    billingSubscriptionEvents,
    billingSubscriptions,
    eq,
    sql
} from '@repo/db';
import { users } from '@repo/db/schemas';
import { RoleEnum, SubscriptionStatusEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { completeSupersessionPairing } from '../../src/services/billing/reactivation-supersession-complete';
import { closeTestDb, createTestDb, createTestUser, isDatabaseAvailable } from '../helpers/test-db';

vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

describe.skipIf(!isDatabaseAvailable())(
    'HOS-123 T-017: cross-path supersession idempotency (real DB)',
    () => {
        let db: ReturnType<typeof createTestDb>;
        let testUserId: string;
        let testCustomerId: string;

        /**
         * Counts `billing_subscription_events` audit rows for one specific
         * `(newSubscriptionId, supersededId)` pairing.
         */
        async function countAuditRowsForPairing(
            newSubscriptionId: string,
            supersededId: string
        ): Promise<number> {
            if (!db) throw new Error('Database not initialized');
            const rows = await db
                .select({ id: billingSubscriptionEvents.id })
                .from(billingSubscriptionEvents)
                .where(
                    and(
                        eq(billingSubscriptionEvents.subscriptionId, newSubscriptionId),
                        sql`${billingSubscriptionEvents.metadata}->>'supersededSubscriptionId' = ${supersededId}`
                    )
                );
            return rows.length;
        }

        /** Inserts a minimal billing_subscriptions row and returns its id. */
        async function insertSubscription(overrides: {
            status: string;
            billingInterval: 'month' | 'year';
        }): Promise<string> {
            if (!db) throw new Error('Database not initialized');
            const id = crypto.randomUUID();
            await db.insert(billingSubscriptions).values({
                id,
                customerId: testCustomerId,
                planId: crypto.randomUUID(),
                billingInterval: overrides.billingInterval,
                status: overrides.status,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                metadata: {}
            } as any);
            return id;
        }

        beforeAll(async () => {
            db = createTestDb();
            if (!db) {
                throw new Error('Failed to create test database');
            }

            // NOTE: this DB is NOT guaranteed to be an isolated/empty test
            // database (this worktree's `HOSPEDA_DATABASE_URL` currently
            // points at the shared dev DB) — every row created here is
            // scoped by a fresh random UUID and deleted precisely by id in
            // `afterAll` below. Never use `cleanupTestDb()` (unscoped
            // `DELETE FROM users` / `DELETE FROM billing_customers`) against
            // a non-isolated DB — it wipes every row in those tables.
            const testUser = await createTestUser(db, RoleEnum.HOST, {
                email: 'hos123-t017@example.com'
            });
            testUserId = testUser.id;

            const customerResult = await db
                .insert(billingCustomers)
                .values({
                    id: crypto.randomUUID(),
                    externalId: testUser.id,
                    email: 'hos123-t017@example.com',
                    name: 'HOS-123 T-017 Test User',
                    metadata: {}
                } as any)
                .returning();
            testCustomerId = (customerResult as { id: string }[])[0]?.id ?? '';
        });

        afterAll(async () => {
            if (db) {
                // Scoped cleanup ONLY — see the beforeAll note above. Order
                // matters for FK constraints: subscriptions (which cascade
                // into their audit events) -> billing customer -> user.
                await db
                    .delete(billingSubscriptions)
                    .where(eq(billingSubscriptions.customerId, testCustomerId));
                await db.delete(billingCustomers).where(eq(billingCustomers.id, testCustomerId));
                await db.delete(users).where(eq(users.id, testUserId));
            }
            await closeTestDb();
        });

        it('a sequential webhook redelivery via the SAME shared function no-ops on the second call (app-level guard) and calls cancel() at most once', async () => {
            if (!db) throw new Error('Database not initialized');

            // Arrange — seed one "new" (superseding) sub and one "superseded" sub,
            // as if an annual reactivation had just confirmed.
            const newSubscriptionId = await insertSubscription({
                status: SubscriptionStatusEnum.ACTIVE,
                billingInterval: 'year'
            });
            const supersededId = await insertSubscription({
                status: SubscriptionStatusEnum.TRIALING,
                billingInterval: 'month'
            });

            const mockCancel = vi.fn().mockResolvedValue(undefined);
            const mockGet = vi.fn().mockResolvedValue({ id: supersededId, status: 'canceled' });
            const billing = { subscriptions: { cancel: mockCancel, get: mockGet } };
            const paymentAdapter = { subscriptions: { retrieve: vi.fn() } };

            const pairingArgs = {
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db,
                newSubscription: {
                    id: newSubscriptionId,
                    customerId: testCustomerId,
                    planId: 'plan-annual-reactivate'
                },
                supersededId,
                triggerSource: 'trial-reactivation' as const,
                source: 'webhook'
            };

            // Act — simulate the annual `payment.updated` path completing first,
            // then a redelivered monthly `subscription_preapproval.created`
            // event (or the reconcile cron) arriving for the SAME pairing.
            const firstOutcome = await completeSupersessionPairing({
                ...pairingArgs,
                providerEventId: 'payment-updated-evt-1'
            });
            const secondOutcome = await completeSupersessionPairing({
                ...pairingArgs,
                providerEventId: 'preapproval-created-evt-1'
            });

            // Assert
            expect(firstOutcome).toBe('completed');
            expect(secondOutcome).toBe('already-audited');

            // Never double-cancel the provider subscription.
            expect(mockCancel).toHaveBeenCalledTimes(1);

            // Exactly one audit row for this pairing, never two.
            const auditRowCount = await countAuditRowsForPairing(newSubscriptionId, supersededId);
            expect(auditRowCount).toBe(1);
        });

        it('the extras/029 partial unique index rejects a genuine duplicate audit row for the same pairing, even bypassing the app-level guard', async () => {
            if (!db) throw new Error('Database not initialized');

            // Arrange — a fresh pairing, independent of the test above.
            const newSubscriptionId = await insertSubscription({
                status: SubscriptionStatusEnum.ACTIVE,
                billingInterval: 'year'
            });
            const supersededId = await insertSubscription({
                status: SubscriptionStatusEnum.CANCELLED,
                billingInterval: 'month'
            });

            const insertRow = () =>
                db!
                    .insert(billingSubscriptionEvents)
                    .values({
                        subscriptionId: newSubscriptionId,
                        previousStatus: SubscriptionStatusEnum.CANCELLED,
                        newStatus: SubscriptionStatusEnum.ACTIVE,
                        triggerSource: 'subscription-reactivation',
                        providerEventId: crypto.randomUUID(),
                        metadata: {
                            supersededSubscriptionId: supersededId,
                            reactivatedFromCanceled: 'true'
                        }
                    })
                    .onConflictDoNothing()
                    .returning({ id: billingSubscriptionEvents.id });

            // Act — insert the SAME pairing twice directly, bypassing the
            // application-level SELECT pre-check entirely. This simulates the
            // worst case: both callers already passed Step 1 before either
            // INSERT committed (a true concurrent race), so the ONLY thing
            // left standing between them is the DB constraint itself.
            const firstInsertResult = await insertRow();
            const secondInsertResult = await insertRow();

            // Assert — the first insert succeeds; the second is silently
            // dropped by `onConflictDoNothing()` because the partial unique
            // index treats it as a conflict on
            // (subscription_id, metadata->>'supersededSubscriptionId').
            expect(firstInsertResult).toHaveLength(1);
            expect(secondInsertResult).toHaveLength(0);

            const auditRowCount = await countAuditRowsForPairing(newSubscriptionId, supersededId);
            expect(auditRowCount).toBe(1);
        });
    }
);
