import { eq, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { createAdjustableClock } from '@repo/test-clock';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { enterManualGraceInTx } from '../../../../../packages/service-core/src/services/billing/subscription/manual-grace-entry';
import { initApp } from '../../../src/app';
import { protectedBillingSubscriptionReadRoutes } from '../../../src/routes/billing-subscription';
import type { AppBindings } from '../../../src/types';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from './revocation-route-fixtures';
import { startPlanChangeScenario, withCompositionRollback } from './succession-wiring-fixtures';

const clock = createAdjustableClock({ start: new Date('2026-10-05T12:00:00.000Z') });
const fake = new FakePaymentProvider({
    idNamespace: crypto.randomUUID(),
    clock,
    honestAbout: [{ lie: 'M1', why: 'fixture signup' }]
});
const pathOf = (id: string) => `/api/v1/protected/billing-subscription/${id}/plan-change`;
let app: ReturnType<typeof initApp>;
const ownerHeaders = (id: string) => actorHeaders({ id, role: 'USER', permissions: [] });
/** HOS-2218: the owner route requires the declared payer email. */
const payerEmail = 'payer@example.test';
const post = (id: string, ownerId: string, body: unknown) =>
    app.request(pathOf(id), {
        method: 'POST',
        headers: ownerHeaders(ownerId),
        body: JSON.stringify(body)
    });

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock });
    injectPaymentProvider({ provider: fake });
    app = initApp({ clock, paymentProvider: fake });
});
afterAll(async () => testDb.teardown());

describe('TEST:B8b:17 plan change route rejects grace', () => {
    it('answers 409 CONFLICT while the activated subscription has no next charge date', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await startPlanChangeScenario(tx, {
                provider: fake,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                },
                direction: 'DOWN',
                leaveCycleEndPending: true
            });
            const [activated] = await tx
                .select({ status: subscriptions.status, nextChargeAt: subscriptions.nextChargeAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, row.subscriptionId));
            // HOS-2223: S2 copies the provider's date, so the real activation fills it.
            expect(activated).toEqual({ status: 'ACTIVE', nextChargeAt: expect.any(Date) });
            // A provider read that reported no date leaves it unknown: the 409 still holds.
            await tx
                .update(subscriptions)
                .set({ nextChargeAt: null })
                .where(eq(subscriptions.id, row.subscriptionId));
            const response = await post(row.subscriptionId, row.userId, {
                billingOptionId: row.targetOptionId,
                payerEmail
            });
            expect(response.status).toBe(409);
            expect((await response.json()) as object).toMatchObject({
                error: { code: 'CONFLICT', details: { reason: 'CYCLE_END_PENDING' } }
            });
        });
    });

    it('(a) answers 409 GRACE_PERIOD and creates no successor', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await startPlanChangeScenario(tx, {
                provider: fake,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                }
            });
            expect(
                await enterManualGraceInTx({
                    tx,
                    subscriptionId: row.subscriptionId,
                    now: clock.now(),
                    graceDays: 10
                })
            ).toBe(true);
            const response = await post(row.subscriptionId, row.userId, {
                billingOptionId: row.targetOptionId,
                payerEmail
            });
            expect(response.status).toBe(409);
            expect(
                ((await response.json()) as { error: { details: { reason: string } } }).error
                    .details.reason
            ).toBe('GRACE_PERIOD');
            const rows = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.userId, row.userId));
            expect(rows).toHaveLength(1);
        });
    });

    it('(b) orders session, verification, body, ownership and destination errors', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await startPlanChangeScenario(tx, {
                provider: fake,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                }
            });
            const missingSession = await app.request(pathOf(row.subscriptionId), {
                method: 'POST',
                headers: actorHeaders(),
                body: JSON.stringify({ billingOptionId: row.targetOptionId })
            });
            expect(missingSession.status).toBe(401);
            const unverifiedApp = new Hono<AppBindings>();
            unverifiedApp.use('*', async (ctx, next) => {
                ctx.set('actor', {
                    id: crypto.randomUUID(),
                    roles: [RoleEnum.USER],
                    permissions: [],
                    emailVerified: false
                });
                await next();
            });
            unverifiedApp.route(
                '/api/v1/protected/billing-subscription',
                protectedBillingSubscriptionReadRoutes
            );
            const unverified = await unverifiedApp.request(pathOf(row.subscriptionId), {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ billingOptionId: row.targetOptionId })
            });
            expect(unverified.status).toBe(403);
            expect(((await unverified.json()) as { error: { code: string } }).error.code).toBe(
                ServiceErrorCode.EMAIL_NOT_VERIFIED
            );
            expect((await post(row.subscriptionId, row.userId, {})).status).toBe(400);
            const foreign = await post(row.subscriptionId, crypto.randomUUID(), {
                billingOptionId: row.targetOptionId,
                payerEmail
            });
            expect(foreign.status).toBe(404);
            expect(((await foreign.json()) as { error: unknown }).error).toEqual({
                code: 'NOT_FOUND',
                message: 'Subscription not found'
            });
            expect(
                (
                    await post(row.subscriptionId, row.userId, {
                        billingOptionId: crypto.randomUUID(),
                        payerEmail
                    })
                ).status
            ).toBe(404);
        });
    });

    it('(c) answers 422 NO_CHANGE', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await startPlanChangeScenario(tx, {
                provider: fake,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                }
            });
            const response = await post(row.subscriptionId, row.userId, {
                billingOptionId: row.sourceOptionId,
                payerEmail
            });
            expect(response.status).toBe(422);
            expect(
                ((await response.json()) as { error: { details: { reason: string } } }).error
                    .details.reason
            ).toBe('NO_CHANGE');
        });
    });
});

describe('HOS-2218 owner plan change carries the declared payer email', () => {
    it('answers 400 without payerEmail and creates no successor', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await startPlanChangeScenario(tx, {
                provider: fake,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                }
            });
            const response = await post(row.subscriptionId, row.userId, {
                billingOptionId: row.targetOptionId
            });
            expect(response.status).toBe(400);
            const rows = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.userId, row.userId));
            expect(rows).toHaveLength(1);
        });
    });

    it('sends the declared payer email to the provider and stores it on the successor', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await startPlanChangeScenario(tx, {
                provider: fake,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                }
            });
            const authorize = vi.spyOn(fake, 'authorize');
            const response = await post(row.subscriptionId, row.userId, {
                billingOptionId: row.targetOptionId,
                payerEmail: 'changed-payer@example.test'
            });
            expect(response.status, await response.clone().text()).toBe(200);
            expect(authorize.mock.calls.at(-1)?.[0].payerEmail).toBe('changed-payer@example.test');
            authorize.mockRestore();
            const [successor] = await tx
                .select({ declaredPayerEmail: subscriptions.declaredPayerEmail })
                .from(subscriptions)
                .where(eq(subscriptions.succeedsId, row.subscriptionId));
            expect(successor?.declaredPayerEmail).toBe('changed-payer@example.test');
        });
    });
});
