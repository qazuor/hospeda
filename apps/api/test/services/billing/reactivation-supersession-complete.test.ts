/**
 * Unit tests for the shared "complete one reactivation supersession pairing"
 * step (HOS-114 T-015a/T-016, second adversarial-review pass).
 *
 * Covers:
 * - Idempotency: an existing audit row for the pairing skips everything else.
 * - Superseded row not found: skipped, no cancel call.
 * - No `mpSubscriptionId` (trial-reactivation flow, superseded sub never had
 *   a real preapproval) — re-verify falls back to `billing.subscriptions.get()`
 *   (local storage), which is safe there because there is no live preapproval
 *   to leak money through.
 * - `mpSubscriptionId` present (lapsed-reactivation flow, superseded sub once
 *   had a real preapproval) — re-verify goes through
 *   `paymentAdapter.subscriptions.retrieve()` (the PROVIDER), never the local
 *   row, so a "live-preapproval-but-locally-canceled" sub is genuinely
 *   reconciled instead of trusting a stale local read.
 * - Terminal ALLOW-list: only `canceled`/`cancelled`/`incomplete_expired`/
 *   `finished`/`expired` count as confirmed-terminal. `paused`, `past_due`,
 *   `pending`, and unknown/unresolved statuses must NOT write the audit row.
 * - The provider `retrieve()` call itself throwing is treated as unresolved
 *   (conservative — never falsely marks a pairing done).
 * - Unexpected errors (e.g. the audit insert throwing) are caught and
 *   reported as `'error'`, never propagate.
 *
 * @module test/services/billing/reactivation-supersession-complete
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import * as Sentry from '@sentry/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeSupersessionPairing } from '../../../src/services/billing/reactivation-supersession-complete';

vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

/**
 * A minimal Drizzle-like `db` fake supporting the two sequential
 * `.select().from().where().limit()` calls `completeSupersessionPairing`
 * issues (idempotency check, then the superseded-row lookup) and one
 * `.insert().values().onConflictDoNothing()` call — the trailing
 * `onConflictDoNothing()` is the atomic backstop against the partial
 * unique index added in
 * `packages/db/src/migrations/extras/029-hos114-supersession-audit-unique.index.sql`.
 */
function makeDbFake(
    options: {
        existingAuditRows?: unknown[];
        supersededRows?: unknown[];
        insertShouldFail?: boolean;
    } = {}
) {
    const { existingAuditRows = [], supersededRows = [], insertShouldFail = false } = options;
    const selectResultsInOrder = [existingAuditRows, supersededRows];
    let callIndex = 0;

    const select = vi.fn().mockImplementation(() => {
        const rows = selectResultsInOrder[callIndex] ?? [];
        callIndex++;
        return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue(rows)
        };
    });

    const onConflictDoNothing = insertShouldFail
        ? vi.fn().mockRejectedValue(new Error('audit insert failed'))
        : vi.fn().mockResolvedValue(undefined);
    const insertValues = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values: insertValues });

    return { select, insert, insertValues, onConflictDoNothing };
}

const NEW_SUBSCRIPTION = { id: 'sub-new-001', customerId: 'cust-001', planId: 'plan-001' };
const SUPERSEDED_ID = 'sub-old-001';
const MP_SUBSCRIPTION_ID = 'mp-preapproval-old-001';

describe('completeSupersessionPairing', () => {
    let mockCancel: ReturnType<typeof vi.fn>;
    let mockGet: ReturnType<typeof vi.fn>;
    let mockRetrieve: ReturnType<typeof vi.fn>;
    let billing: {
        subscriptions: { cancel: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
    };
    let paymentAdapter: { subscriptions: { retrieve: ReturnType<typeof vi.fn> } };

    beforeEach(() => {
        vi.clearAllMocks();
        mockCancel = vi.fn().mockResolvedValue(undefined);
        mockGet = vi.fn();
        mockRetrieve = vi.fn();
        billing = { subscriptions: { cancel: mockCancel, get: mockGet } };
        paymentAdapter = { subscriptions: { retrieve: mockRetrieve } };
    });

    describe('idempotency', () => {
        it('returns "already-audited" and never calls cancel when an audit row already exists', async () => {
            const db = makeDbFake({ existingAuditRows: [{ id: 'existing-evt' }] });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'trial-reactivation',
                providerEventId: 'evt-001',
                source: 'webhook'
            });

            expect(outcome).toBe('already-audited');
            expect(mockCancel).not.toHaveBeenCalled();
            expect(mockGet).not.toHaveBeenCalled();
            expect(mockRetrieve).not.toHaveBeenCalled();
            expect(db.insert).not.toHaveBeenCalled();
        });
    });

    describe('superseded row not found', () => {
        it('returns "superseded-not-found" and never calls cancel', async () => {
            const db = makeDbFake({ existingAuditRows: [], supersededRows: [] });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'trial-reactivation',
                providerEventId: 'evt-002',
                source: 'webhook'
            });

            expect(outcome).toBe('superseded-not-found');
            expect(mockCancel).not.toHaveBeenCalled();
            expect(db.insert).not.toHaveBeenCalled();
        });
    });

    describe('no mpSubscriptionId (trial-reactivation flow — never had a real preapproval)', () => {
        it('re-verifies via billing.subscriptions.get() (local) and writes the audit row when confirmed cancelled', async () => {
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [{ id: SUPERSEDED_ID, status: 'trialing', mpSubscriptionId: null }]
            });
            mockGet.mockResolvedValue({ id: SUPERSEDED_ID, status: 'canceled' });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'trial-reactivation',
                providerEventId: 'evt-003',
                source: 'webhook'
            });

            expect(outcome).toBe('completed');
            expect(mockCancel).toHaveBeenCalledWith(SUPERSEDED_ID);
            expect(mockGet).toHaveBeenCalledWith(SUPERSEDED_ID);
            // No mpSubscriptionId — the provider must never be consulted.
            expect(mockRetrieve).not.toHaveBeenCalled();
            expect(db.insertValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    subscriptionId: NEW_SUBSCRIPTION.id,
                    previousStatus: SubscriptionStatusEnum.TRIALING,
                    newStatus: SubscriptionStatusEnum.ACTIVE,
                    triggerSource: 'trial-reactivation',
                    providerEventId: 'evt-003',
                    metadata: expect.objectContaining({
                        supersededSubscriptionId: SUPERSEDED_ID,
                        convertedFromTrial: 'true'
                    })
                })
            );
            expect(Sentry.captureException).not.toHaveBeenCalled();
        });

        it('does NOT write the audit row when the local re-verify still shows trialing', async () => {
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [{ id: SUPERSEDED_ID, status: 'trialing', mpSubscriptionId: null }]
            });
            mockCancel.mockRejectedValue(new Error('unexpected'));
            mockGet.mockResolvedValue({ id: SUPERSEDED_ID, status: 'trialing' });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'trial-reactivation',
                providerEventId: 'evt-004',
                source: 'webhook'
            });

            expect(outcome).toBe('cancel-did-not-take');
            expect(db.insert).not.toHaveBeenCalled();
            expect(Sentry.captureException).toHaveBeenCalled();
        });
    });

    describe('mpSubscriptionId present (lapsed-reactivation flow — once had a real preapproval)', () => {
        it('re-verifies via the PROVIDER (paymentAdapter.subscriptions.retrieve), NOT the local row', async () => {
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [
                    { id: SUPERSEDED_ID, status: 'canceled', mpSubscriptionId: MP_SUBSCRIPTION_ID }
                ]
            });
            // The lapsed flow's expected outcome: cancel() throws "already
            // cancelled" (harmless), and the PROVIDER confirms terminal.
            mockCancel.mockRejectedValue(new Error('Subscription already cancelled'));
            mockRetrieve.mockResolvedValue({ status: 'canceled' });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'subscription-reactivation',
                providerEventId: 'evt-005',
                source: 'webhook'
            });

            expect(outcome).toBe('completed');
            expect(mockRetrieve).toHaveBeenCalledWith(MP_SUBSCRIPTION_ID);
            // The local billing.get() must NEVER be consulted when a provider
            // mapping exists — that was the exact bug this fix corrects.
            expect(mockGet).not.toHaveBeenCalled();
            expect(db.insertValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    previousStatus: SubscriptionStatusEnum.CANCELLED,
                    triggerSource: 'subscription-reactivation',
                    metadata: expect.objectContaining({ reactivatedFromCanceled: 'true' })
                })
            );
        });

        it('REGRESSION (blocker): does NOT write the audit row when the local status is already "canceled" but the PROVIDER still reports the preapproval live', async () => {
            // This is the exact scenario the second adversarial review
            // flagged: `billing.subscriptions.get()` alone would have read
            // the LOCAL 'canceled' status and falsely concluded
            // confirmed-terminal, masking a still-live MercadoPago
            // preapproval that can keep charging the customer.
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [
                    { id: SUPERSEDED_ID, status: 'canceled', mpSubscriptionId: MP_SUBSCRIPTION_ID }
                ]
            });
            mockCancel.mockRejectedValue(new Error('MercadoPago 503'));
            // Provider truth: still active, despite the stale local row.
            mockRetrieve.mockResolvedValue({ status: 'active' });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'subscription-reactivation',
                providerEventId: 'evt-006',
                source: 'webhook'
            });

            expect(outcome).toBe('cancel-did-not-take');
            expect(db.insert).not.toHaveBeenCalled();
            expect(Sentry.captureException).toHaveBeenCalled();
        });

        it('treats a failed provider retrieve() as unresolved (conservative — never falsely marks done)', async () => {
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [
                    { id: SUPERSEDED_ID, status: 'canceled', mpSubscriptionId: MP_SUBSCRIPTION_ID }
                ]
            });
            mockRetrieve.mockRejectedValue(new Error('MP network timeout'));

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'subscription-reactivation',
                providerEventId: 'evt-007',
                source: 'webhook'
            });

            expect(outcome).toBe('cancel-did-not-take');
            expect(db.insert).not.toHaveBeenCalled();
        });
    });

    describe('MEDIUM fix: terminal ALLOW-list (paused/past_due/unknown must NOT be treated as terminal)', () => {
        it.each([
            ['paused', 'active preapproval merely paused — can resume and charge'],
            ['past_due', 'payment failing but preapproval still live — can recover and charge'],
            ['pending', 'not yet resolved at the provider'],
            ['some-unrecognized-status', 'unknown status — never assume terminal']
        ])('does NOT write the audit row when the re-verified status is "%s" (%s)', async (status) => {
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [
                    { id: SUPERSEDED_ID, status: 'active', mpSubscriptionId: MP_SUBSCRIPTION_ID }
                ]
            });
            mockRetrieve.mockResolvedValue({ status });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'subscription-reactivation',
                providerEventId: 'evt-008',
                source: 'webhook'
            });

            expect(outcome).toBe('cancel-did-not-take');
            expect(db.insert).not.toHaveBeenCalled();
            expect(Sentry.captureException).toHaveBeenCalled();
        });

        it.each([
            'canceled',
            'cancelled',
            'incomplete_expired',
            'finished',
            'expired'
        ])('DOES write the audit row when the re-verified status is the known-terminal "%s"', async (status) => {
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [
                    {
                        id: SUPERSEDED_ID,
                        status: 'active',
                        mpSubscriptionId: MP_SUBSCRIPTION_ID
                    }
                ]
            });
            mockRetrieve.mockResolvedValue({ status });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'subscription-reactivation',
                providerEventId: 'evt-009',
                source: 'webhook'
            });

            expect(outcome).toBe('completed');
            expect(db.insertValues).toHaveBeenCalledOnce();
        });
    });

    describe('unexpected errors', () => {
        it('returns "error" and never throws when the audit insert itself fails', async () => {
            const db = makeDbFake({
                existingAuditRows: [],
                supersededRows: [{ id: SUPERSEDED_ID, status: 'trialing', mpSubscriptionId: null }],
                insertShouldFail: true
            });
            mockGet.mockResolvedValue({ id: SUPERSEDED_ID, status: 'canceled' });

            const outcome = await completeSupersessionPairing({
                billing: billing as never,
                paymentAdapter: paymentAdapter as never,
                db: db as never,
                newSubscription: NEW_SUBSCRIPTION,
                supersededId: SUPERSEDED_ID,
                triggerSource: 'trial-reactivation',
                providerEventId: 'evt-010',
                source: 'webhook'
            });

            expect(outcome).toBe('error');
            expect(Sentry.captureException).toHaveBeenCalled();
        });
    });
});
