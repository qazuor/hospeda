/**
 * HOS-1012 T-039 — `POST /protected/billing/promo-codes/apply`, trial_extension branch.
 *
 * This is the regression lock on the bug T-039 fixed. The route used to answer a
 * `trialEnd` computed from `new Date()` inside the handler — a projection that
 * was never written to any row — while `applyPromoCode` redeemed the code
 * anyway. The host was told a date that did not exist and the code was spent.
 *
 * What is asserted here is exactly that: the `trialEnd` on the wire is the value
 * the MUTATION reported as persisted. The fixture deliberately uses a persisted
 * date that no projection could produce (a past date, and one carrying
 * minutes/seconds), so re-deriving the response from `now + extraDays` fails the
 * assertion instead of coincidentally matching it.
 *
 * The handler is invoked directly with a mock context (same pattern as
 * `handleCheckExpiry` in `billing-trial-admin.test.ts`) so the middleware stack
 * is not in play.
 *
 * @module test/routes/promo-codes-apply-trial-extension
 */

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

vi.mock('../../src/utils/env', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../src/utils/env')>()),
    env: { NODE_ENV: 'test' }
}));

vi.mock('../../src/middlewares/auth', () => ({
    authMiddleware: vi.fn(() => async (_c: unknown, next: () => unknown) => next()),
    requireAuth: vi.fn(async (_c: unknown, next: () => unknown) => next())
}));

vi.mock('../../src/middlewares/billing-customer', () => ({
    billingCustomerMiddleware: vi.fn(() => async (_c: unknown, next: () => unknown) => next())
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    entitlementMiddleware: vi.fn(() => async (_c: unknown, next: () => unknown) => next())
}));

vi.mock('../../src/middlewares/trial', () => ({
    trialMiddleware: vi.fn(() => async (_c: unknown, next: () => unknown) => next())
}));

const getActorFromContextMock = vi.fn();
vi.mock('../../src/middlewares/actor', () => ({
    actorMiddleware: vi.fn(() => async (_c: unknown, next: () => unknown) => next()),
    getActorFromContext: (...args: unknown[]) => getActorFromContextMock(...args)
}));

vi.mock('../../src/middlewares/billing', () => ({
    billingMiddleware: vi.fn(async (_c: unknown, next: () => unknown) => next()),
    getQZPayBilling: vi.fn(() => ({})),
    requireBilling: vi.fn(async (_c: unknown, next: () => unknown) => next())
}));

const getByCodeMock = vi.fn();
const applyMock = vi.fn();
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    PromoCodeService: vi.fn(function () {
        return { getByCode: getByCodeMock, apply: applyMock };
    }),
    assertSubscriptionOwnership: vi.fn(async () => ({ success: true }))
}));

const applyTrialExtensionToRunningTrialMock = vi.fn();
vi.mock('../../src/services/promo-trial-extension-apply.service', () => ({
    NO_ACTIVE_TRIAL_ERROR_CODE: 'NO_ACTIVE_TRIAL',
    applyTrialExtensionToRunningTrial: (...args: unknown[]) =>
        applyTrialExtensionToRunningTrialMock(...args)
}));

import { handleApplyPromoCode } from '../../src/routes/billing/promo-codes.apply';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BILLING_CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const TRIAL_SUBSCRIPTION_ID = '33333333-3333-4333-8333-333333333333';

/**
 * The `trial_end` the mutation reports as PERSISTED.
 *
 * Chosen so a projection cannot match it by accident: it is in the past, and it
 * carries minutes and seconds that `new Date()` + N whole days would not
 * reproduce.
 */
const PERSISTED_TRIAL_END = new Date('2026-02-03T04:05:06.000Z');

function buildContext(billingCustomerId: string | null = BILLING_CUSTOMER_ID): Context {
    return {
        get: vi.fn((key: string) => (key === 'billingCustomerId' ? billingCustomerId : undefined))
    } as unknown as Context;
}

describe('POST /protected/billing/promo-codes/apply — trial_extension (HOS-1012 T-039)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActorFromContextMock.mockReturnValue({ id: ACTOR_ID, permissions: [] });
        getByCodeMock.mockResolvedValue({
            success: true,
            data: {
                id: 'pc-lanzamiento60',
                code: 'LANZAMIENTO60',
                effect: { kind: 'trial_extension', extraDays: 60 }
            }
        });
        applyTrialExtensionToRunningTrialMock.mockResolvedValue({
            success: true,
            data: {
                subscriptionId: TRIAL_SUBSCRIPTION_ID,
                newTrialEnd: PERSISTED_TRIAL_END,
                daysAdded: 60,
                usageRecordId: 'usage-row-1'
            }
        });
    });

    it('answers the PERSISTED trial_end, not a date projected from now', async () => {
        // Act
        const result = (await handleApplyPromoCode(
            buildContext(),
            {},
            { code: 'LANZAMIENTO60' }
        )) as Record<string, unknown>;

        // Assert — the wire value IS the mutation's value.
        expect(result.trialEnd).toBe(PERSISTED_TRIAL_END.toISOString());
        expect(result.extraDays).toBe(60);
        expect(result.effectKind).toBe('trial_extension');

        // And it is not a projection: `now + 60 days` is a different instant.
        const projected = new Date();
        projected.setUTCDate(projected.getUTCDate() + 60);
        expect(result.trialEnd).not.toBe(projected.toISOString());
    });

    it('routes the code through the real mutator, never through service.apply', async () => {
        await handleApplyPromoCode(buildContext(), {}, { code: 'LANZAMIENTO60' });

        expect(applyTrialExtensionToRunningTrialMock).toHaveBeenCalledTimes(1);
        expect(applyTrialExtensionToRunningTrialMock).toHaveBeenCalledWith(
            expect.objectContaining({
                code: 'LANZAMIENTO60',
                billingCustomerId: BILLING_CUSTOMER_ID,
                actorId: ACTOR_ID
            })
        );
        // `service.apply` redeems the code and returns nothing persisted — the
        // trial_extension branch must never reach it again.
        expect(applyMock).not.toHaveBeenCalled();
    });

    it('forwards an explicitly named subscription to the mutator', async () => {
        await handleApplyPromoCode(
            buildContext(),
            {},
            {
                code: 'LANZAMIENTO60',
                subscriptionId: TRIAL_SUBSCRIPTION_ID
            }
        );

        expect(applyTrialExtensionToRunningTrialMock).toHaveBeenCalledWith(
            expect.objectContaining({ subscriptionId: TRIAL_SUBSCRIPTION_ID })
        );
    });

    it('answers 422 when there is no trial running, without redeeming the code', async () => {
        applyTrialExtensionToRunningTrialMock.mockResolvedValue({
            success: false,
            error: {
                code: 'NO_ACTIVE_TRIAL',
                message:
                    'No trial is currently running on this account. The promo code was not used.'
            }
        });

        await expect(
            handleApplyPromoCode(buildContext(), {}, { code: 'FREEMONTH' })
        ).rejects.toMatchObject({ status: 422 });

        expect(applyMock).not.toHaveBeenCalled();
    });

    it('answers 409 when the code was already used by this customer', async () => {
        applyTrialExtensionToRunningTrialMock.mockResolvedValue({
            success: false,
            error: {
                code: 'PROMO_CODE_MAX_USES_PER_CUSTOMER',
                message: 'You have already used this promo code'
            }
        });

        await expect(
            handleApplyPromoCode(buildContext(), {}, { code: 'LANZAMIENTO60' })
        ).rejects.toBeInstanceOf(HTTPException);
        await expect(
            handleApplyPromoCode(buildContext(), {}, { code: 'LANZAMIENTO60' })
        ).rejects.toMatchObject({ status: 409 });
    });

    it('accepts a self-service body with no customerId and answers with the caller own customer', async () => {
        const result = (await handleApplyPromoCode(
            buildContext(),
            {},
            { code: 'LANZAMIENTO60' }
        )) as Record<string, unknown>;

        expect(result.id).toBe(BILLING_CUSTOMER_ID);
    });

    it('still rejects an explicitly supplied foreign customerId with 403', async () => {
        await expect(
            handleApplyPromoCode(
                buildContext(),
                {},
                {
                    code: 'LANZAMIENTO60',
                    customerId: '99999999-9999-4999-8999-999999999999'
                }
            )
        ).rejects.toMatchObject({ status: 403 });

        expect(applyTrialExtensionToRunningTrialMock).not.toHaveBeenCalled();
    });
});
