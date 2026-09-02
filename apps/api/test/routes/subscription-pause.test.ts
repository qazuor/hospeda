/**
 * Unit tests for the self-serve subscription pause handler (SPEC-194 T-023).
 *
 * Covers:
 * - Happy path: monthly active subscription is paused successfully.
 * - Annual (HOS-995): an annual subscription with a preapproval is paused like
 *   any other. This block previously asserted the reverse — a 400
 *   PAUSE_NOT_SUPPORTED_FOR_ANNUAL — on a premise HOS-171 retired.
 * - No-preapproval guard (HOS-995): the real "nothing to pause" condition.
 * - Provider refusal (HOS-995): fail-closed 502, plus a durable audit seat.
 * - 503 when billing is not configured.
 * - 400 when no billing account found.
 * - 404 when no active subscription exists.
 * - Soft-cancel guard (HOS-246): a soft-cancelled (cancelAtPeriodEnd=true)
 *   active/trialing sub → 409 PAUSE_NOT_ALLOWED_CANCELLATION_SCHEDULED, and the
 *   409 takes precedence over the 400 annual error when both apply.
 *
 * @module test/routes/subscription-pause
 */

import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn().mockReturnValue({ id: 'user-123' })
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/services/subscription-pause.service', () => ({
    setOwnerServiceSuspension: vi.fn().mockResolvedValue({ accommodationsUpdated: 0 })
}));

vi.mock('../../src/services/billing/pause-refusal-audit', () => ({
    recordPauseProviderRefusal: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../src/utils/route-factory', () => ({
    createSimpleRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

// `insertValues`/`insert` are hoisted so both the mock factory (hoisted above
// imports by vitest) and the test bodies below can reference the same spies —
// this is what lets tests assert on the actual `eventType` persisted, instead
// of only on the handler's return value (see `feedback_api_global_db_mock_makes_query_tests_vacuous`).
const { insertValues, insertSpy } = vi.hoisted(() => ({
    insertValues: vi.fn().mockResolvedValue(undefined),
    insertSpy: vi.fn()
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn().mockReturnValue({
        insert: insertSpy.mockReturnValue({ values: insertValues })
    }),
    billingSubscriptionEvents: { _: 'billingSubscriptionEvents' }
}));

vi.mock('@repo/schemas', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/schemas')>();
    return {
        ...actual,
        SubscriptionStatusEnum: {
            PAUSED: 'paused',
            ACTIVE: 'active'
        },
        SubscriptionPauseResumeResponseSchema: {}
    };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        BILLING_EVENT_TYPES: {
            HOST_SUBSCRIPTION_PAUSED: 'HOST_SUBSCRIPTION_PAUSED',
            HOST_SUBSCRIPTION_RESUMED: 'HOST_SUBSCRIPTION_RESUMED'
        }
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { BILLING_EVENT_TYPES } from '@repo/service-core';
import { getQZPayBilling } from '../../src/middlewares/billing';
import {
    handleSelfServePause,
    handleSelfServeResume
} from '../../src/routes/billing/subscription-pause';
import { recordPauseProviderRefusal } from '../../src/services/billing/pause-refusal-audit';
import { setOwnerServiceSuspension } from '../../src/services/subscription-pause.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust-abc';

interface ContextOptions {
    billingEnabled?: boolean;
    billingCustomerId?: string | null;
}

function createMockContext(opts: ContextOptions = {}) {
    const { billingEnabled = true, billingCustomerId = CUSTOMER_ID } = opts;
    const store = new Map<string, unknown>([
        ['billingEnabled', billingEnabled],
        ['billingCustomerId', billingCustomerId]
    ]);
    return { get: vi.fn((key: string) => store.get(key)) };
}

interface SubFixture {
    id?: string;
    status?: string;
    metadata?: Record<string, unknown>;
    cancelAtPeriodEnd?: boolean;
    /**
     * The provider ids qzpay carries on every subscription. `mercadopago` is the
     * preapproval the pause acts on; its absence is the only real "there is
     * nothing to pause" condition (HOS-995), so fixtures that expect to be
     * paused must declare one.
     */
    providerSubscriptionIds?: Record<string, string>;
}

/** The preapproval id every pausable fixture carries. */
const MP_PREAPPROVAL = { mercadopago: 'mp-preapproval-1' };

function makeBillingMock(subs: SubFixture[] = []) {
    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(subs),
            pause: vi.fn().mockResolvedValue({ id: subs[0]?.id ?? 'sub-1', status: 'paused' }),
            resume: vi
                .fn()
                .mockImplementation((id: string) => Promise.resolve({ id, status: 'active' }))
        }
    };
}

function mockBilling(billing: ReturnType<typeof makeBillingMock> | null) {
    vi.mocked(getQZPayBilling).mockReturnValue(
        billing as unknown as ReturnType<typeof getQZPayBilling>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleSelfServePause', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // Happy path — monthly subscription
    // -----------------------------------------------------------------------

    it('pauses a monthly active subscription successfully', async () => {
        const sub = {
            id: 'sub-monthly-1',
            status: 'active',
            metadata: { billingInterval: 'monthly' },
            providerSubscriptionIds: MP_PREAPPROVAL
        };
        mockBilling(makeBillingMock([sub]));
        const ctx = createMockContext();

        const result = await handleSelfServePause(ctx as never);

        expect(result.success).toBe(true);
        expect(result.subscriptionId).toBe('sub-monthly-1');
        expect(result.status).toBe('paused');

        // HOS-657: the audit row must carry an eventType, not just newStatus.
        expect(insertSpy).toHaveBeenCalledTimes(1);
        const eventArg = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(eventArg).toMatchObject({
            subscriptionId: 'sub-monthly-1',
            eventType: BILLING_EVENT_TYPES.HOST_SUBSCRIPTION_PAUSED,
            triggerSource: 'host-pause'
        });
    });

    it('pauses a monthly trialing subscription successfully', async () => {
        // Card-first (HOS-171): a trialing subscription is a real preapproval,
        // so it carries a `mercadopago` id and is pausable.
        const sub = {
            id: 'sub-trial-1',
            status: 'trialing',
            metadata: {},
            providerSubscriptionIds: MP_PREAPPROVAL
        };
        const billing = makeBillingMock([sub]);
        mockBilling(billing);
        const ctx = createMockContext();

        const result = await handleSelfServePause(ctx as never);

        expect(result.success).toBe(true);
        expect(billing.subscriptions.pause).toHaveBeenCalledWith('sub-trial-1');
    });

    // -----------------------------------------------------------------------
    // Annual: pausable like any other preapproval (HOS-995)
    //
    // This block used to assert the OPPOSITE — a 400 PAUSE_NOT_SUPPORTED_FOR_ANNUAL
    // and `pause` never being called (SPEC-194 T-023). That guard rested on
    // "annual subscriptions are backed by a single MP payment, not a recurring
    // preapproval", which HOS-171 (card-first) retired: an annual subscription
    // IS a recurring preapproval today, at MP `frequency: 12,
    // frequency_type: 'months'`, and `create-annual-subscription.ts` was
    // deleted. The old tests were green while freezing a refusal the
    // architecture no longer justifies, on a button the web dashboard offers to
    // annual subscribers (`canPause` never looked at the interval).
    // -----------------------------------------------------------------------

    it('pauses an annual active subscription, like any other preapproval', async () => {
        const annualSub = {
            id: 'sub-annual-1',
            status: 'active',
            metadata: { billingInterval: 'annual' },
            providerSubscriptionIds: { mercadopago: 'mp-preapproval-annual' }
        };
        const billing = makeBillingMock([annualSub]);
        mockBilling(billing);
        const ctx = createMockContext();

        const result = await handleSelfServePause(ctx as never);

        expect(result.success).toBe(true);
        expect(result.subscriptionId).toBe('sub-annual-1');
        expect(billing.subscriptions.pause).toHaveBeenCalledWith('sub-annual-1');
    });

    // -----------------------------------------------------------------------
    // The real "there is nothing to pause" condition (HOS-995)
    //
    // Not the interval — the absence of a preapproval. This is what the old
    // guard was reaching for and missed: a legacy annual one-time row has no
    // `mercadopago` provider id, and so does a Hospeda-owned trial, and so does
    // any pre-HOS-171 leftover. Pausing one of those would suspend the owner's
    // listings while changing nothing on the billing side — precisely the
    // "misleading state" the original comment warned about, attached at last to
    // the condition that actually produces it.
    // -----------------------------------------------------------------------

    it.each([
        ['no providerSubscriptionIds at all', undefined],
        ['an empty providerSubscriptionIds map', {}],
        ['provider ids without a mercadopago entry', { stripe: 'sub_x' }]
    ])('refuses to pause a subscription with %s', async (_label, providerSubscriptionIds) => {
        const sub = {
            id: 'sub-no-preapproval',
            status: 'active',
            metadata: { billingInterval: 'annual' },
            providerSubscriptionIds
        };
        const billing = makeBillingMock([sub]);
        mockBilling(billing);
        const ctx = createMockContext();

        try {
            await handleSelfServePause(ctx as never);
            expect.unreachable('the handler must refuse a subscription with no preapproval');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            const httpErr = err as HTTPException;
            expect(httpErr.status).toBe(400);
            expect(httpErr.message).toContain('PAUSE_NO_PREAPPROVAL');
        }

        // Refused before the provider is touched, and before anything local moves.
        expect(billing.subscriptions.pause).not.toHaveBeenCalled();
        expect(setOwnerServiceSuspension).not.toHaveBeenCalled();
        expect(insertSpy).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Provider refusal: fail-closed AND observable (HOS-995)
    //
    // Nobody has verified against the MercadoPago sandbox that pause behaves on
    // a twelve-month preapproval. That is a manual observation, so what code can
    // do is guarantee the failure mode: nothing local changes, the caller gets a
    // typed error rather than an opaque 500, and a durable row records the
    // interval and the provider's own message.
    // -----------------------------------------------------------------------

    it('fails closed and records a seat when MercadoPago refuses the pause', async () => {
        const annualSub = {
            id: 'sub-annual-refused',
            status: 'active',
            metadata: { billingInterval: 'annual' },
            providerSubscriptionIds: { mercadopago: 'mp-preapproval-annual' }
        };
        const billing = makeBillingMock([annualSub]);
        billing.subscriptions.pause.mockRejectedValue(new Error('MP: cannot pause preapproval'));
        mockBilling(billing);
        const ctx = createMockContext();

        try {
            await handleSelfServePause(ctx as never);
            expect.unreachable('a refused pause must not resolve successfully');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            const httpErr = err as HTTPException;
            expect(httpErr.status).toBe(502);
            expect(httpErr.message).toContain('PAUSE_PROVIDER_REFUSED');
        }

        // Fail-closed: the listings are NOT suspended and no PAUSED row is
        // written for a pause that never happened.
        expect(setOwnerServiceSuspension).not.toHaveBeenCalled();
        expect(insertSpy).not.toHaveBeenCalled();

        // Observable: the refusal is seated with the interval that caused it.
        expect(recordPauseProviderRefusal).toHaveBeenCalledTimes(1);
        expect(vi.mocked(recordPauseProviderRefusal).mock.calls[0]?.[0]).toMatchObject({
            subscriptionId: 'sub-annual-refused',
            triggerSource: 'host-pause',
            billingInterval: 'annual'
        });
    });

    // -----------------------------------------------------------------------
    // Billing not configured
    // -----------------------------------------------------------------------

    it('throws 503 when billingEnabled is false', async () => {
        const ctx = createMockContext({ billingEnabled: false });

        await expect(handleSelfServePause(ctx as never)).rejects.toThrow(HTTPException);

        try {
            await handleSelfServePause(ctx as never);
        } catch (err) {
            expect((err as HTTPException).status).toBe(503);
        }
    });

    it('throws 400 when no billing customer id', async () => {
        mockBilling(makeBillingMock([]));
        const ctx = createMockContext({ billingCustomerId: null });

        await expect(handleSelfServePause(ctx as never)).rejects.toThrow(HTTPException);

        try {
            await handleSelfServePause(ctx as never);
        } catch (err) {
            expect((err as HTTPException).status).toBe(400);
        }
    });

    // -----------------------------------------------------------------------
    // No active subscription
    // -----------------------------------------------------------------------

    it('throws 404 when no active or trialing subscription exists', async () => {
        mockBilling(makeBillingMock([{ id: 'sub-paused', status: 'paused', metadata: {} }]));
        const ctx = createMockContext();

        await expect(handleSelfServePause(ctx as never)).rejects.toThrow(HTTPException);

        try {
            await handleSelfServePause(ctx as never);
        } catch (err) {
            expect((err as HTTPException).status).toBe(404);
        }
    });

    // -----------------------------------------------------------------------
    // Courtesy guard (HOS-180 AC-14 / OQ-2) — a courtesy subscription is
    // excluded by omission, same as any other non-active/trialing status. No
    // new gate was added; this pins the omission so a future addition of
    // 'courtesy' to the filter above regresses silently otherwise.
    // -----------------------------------------------------------------------

    it('throws 404 when the only subscription is courtesy (HOS-180)', async () => {
        mockBilling(makeBillingMock([{ id: 'sub-courtesy', status: 'courtesy', metadata: {} }]));
        const ctx = createMockContext();

        await expect(handleSelfServePause(ctx as never)).rejects.toThrow(HTTPException);

        try {
            await handleSelfServePause(ctx as never);
        } catch (err) {
            expect((err as HTTPException).status).toBe(404);
        }
    });

    it('does not call billing.subscriptions.pause for a courtesy-only customer (HOS-180)', async () => {
        const billing = makeBillingMock([{ id: 'sub-courtesy', status: 'courtesy', metadata: {} }]);
        mockBilling(billing);
        const ctx = createMockContext();

        await expect(handleSelfServePause(ctx as never)).rejects.toThrow(HTTPException);
        expect(billing.subscriptions.pause).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Soft-cancel guard (HOS-246) — mirror of the resume guard from HOS-236
    // -----------------------------------------------------------------------

    // ── THE regression guard: a soft-cancelled active sub must NOT be pausable ──
    it('rejects with 409 when the only active sub is scheduled for cancellation (HOS-246)', async () => {
        const softCancelled = {
            id: 'sub-softcancel-1',
            status: 'active',
            metadata: { billingInterval: 'monthly' },
            cancelAtPeriodEnd: true
        };
        const billing = makeBillingMock([softCancelled]);
        mockBilling(billing);
        const ctx = createMockContext();

        try {
            await handleSelfServePause(ctx as never);
            throw new Error('expected handleSelfServePause to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            const httpErr = err as HTTPException;
            expect(httpErr.status).toBe(409);
            expect(httpErr.message).toContain('PAUSE_NOT_ALLOWED_CANCELLATION_SCHEDULED');
        }
        // Pausing a soft-cancelled sub would cut short the grace window — the MP
        // preapproval must NEVER be paused for a cancellation in progress.
        expect(billing.subscriptions.pause).not.toHaveBeenCalled();
    });

    it('rejects with 409 for a soft-cancelled trialing subscription (HOS-246)', async () => {
        const softCancelledTrial = {
            id: 'sub-softcancel-trial',
            status: 'trialing',
            metadata: {},
            cancelAtPeriodEnd: true
        };
        const billing = makeBillingMock([softCancelledTrial]);
        mockBilling(billing);
        const ctx = createMockContext();

        try {
            await handleSelfServePause(ctx as never);
            throw new Error('expected handleSelfServePause to throw');
        } catch (err) {
            expect((err as HTTPException).status).toBe(409);
            expect((err as HTTPException).message).toContain(
                'PAUSE_NOT_ALLOWED_CANCELLATION_SCHEDULED'
            );
        }
        expect(billing.subscriptions.pause).not.toHaveBeenCalled();
    });

    it('pauses the genuinely-active sub and skips the soft-cancelled one when both exist', async () => {
        const softCancelled = {
            id: 'sub-softcancel-2',
            status: 'active',
            metadata: { billingInterval: 'monthly' },
            cancelAtPeriodEnd: true
        };
        const pausable = {
            id: 'sub-active-2',
            status: 'active',
            metadata: { billingInterval: 'monthly' },
            cancelAtPeriodEnd: false,
            providerSubscriptionIds: MP_PREAPPROVAL
        };
        // Ordered soft-cancelled first so the filter must actively skip it.
        const billing = makeBillingMock([softCancelled, pausable]);
        // pause() resolves the id it was called with so the assertion is exact.
        billing.subscriptions.pause = vi
            .fn()
            .mockImplementation((id: string) => Promise.resolve({ id, status: 'paused' }));
        mockBilling(billing);
        const ctx = createMockContext();

        const result = await handleSelfServePause(ctx as never);

        expect(result.subscriptionId).toBe('sub-active-2');
        expect(billing.subscriptions.pause).toHaveBeenCalledWith('sub-active-2');
        expect(billing.subscriptions.pause).not.toHaveBeenCalledWith('sub-softcancel-2');
    });

    // Precedence: a sub that is BOTH unpausable-for-lack-of-preapproval AND
    // soft-cancelled must surface the 409 cancellation-scheduled error, not the
    // 400. The soft-cancel guard runs first, so the sub is excluded from target
    // selection before the preapproval check is ever reached. Documented
    // decision (HOS-246), not accident. HOS-995 re-aimed this from the retired
    // annual error onto the guard that replaced it — the precedence is the
    // invariant, the specific 400 underneath it was not.
    it('returns 409 (not the 400) for a soft-cancelled sub that also has no preapproval', async () => {
        const softCancelledNoPreapproval = {
            id: 'sub-annual-softcancel',
            status: 'active',
            metadata: { billingInterval: 'annual' },
            cancelAtPeriodEnd: true
        };
        const billing = makeBillingMock([softCancelledNoPreapproval]);
        mockBilling(billing);
        const ctx = createMockContext();

        try {
            await handleSelfServePause(ctx as never);
            throw new Error('expected handleSelfServePause to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            const httpErr = err as HTTPException;
            expect(httpErr.status).toBe(409);
            expect(httpErr.message).toContain('PAUSE_NOT_ALLOWED_CANCELLATION_SCHEDULED');
            expect(httpErr.message).not.toContain('PAUSE_NO_PREAPPROVAL');
        }
        expect(billing.subscriptions.pause).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// handleSelfServeResume (HOS-236)
// ---------------------------------------------------------------------------

describe('handleSelfServeResume', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resumes a genuinely user-paused subscription (no pending cancellation)', async () => {
        const sub = {
            id: 'sub-paused-1',
            status: 'paused',
            metadata: {},
            cancelAtPeriodEnd: false
        };
        const billing = makeBillingMock([sub]);
        mockBilling(billing);
        const ctx = createMockContext();

        const result = await handleSelfServeResume(ctx as never);

        expect(result.success).toBe(true);
        expect(result.subscriptionId).toBe('sub-paused-1');
        expect(billing.subscriptions.resume).toHaveBeenCalledWith('sub-paused-1');

        // HOS-657: the audit row must carry an eventType, not just newStatus.
        expect(insertSpy).toHaveBeenCalledTimes(1);
        const eventArg = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(eventArg).toMatchObject({
            subscriptionId: 'sub-paused-1',
            eventType: BILLING_EVENT_TYPES.HOST_SUBSCRIPTION_RESUMED,
            triggerSource: 'host-resume'
        });
    });

    // ── THE regression guard: a soft-cancelled paused sub must NOT be resumable ──
    it('rejects with 409 when the only paused sub is scheduled for cancellation (HOS-236)', async () => {
        const softCancelled = {
            id: 'sub-softcancel-1',
            status: 'paused',
            metadata: {},
            cancelAtPeriodEnd: true
        };
        const billing = makeBillingMock([softCancelled]);
        mockBilling(billing);
        const ctx = createMockContext();

        try {
            await handleSelfServeResume(ctx as never);
            throw new Error('expected handleSelfServeResume to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            const httpErr = err as HTTPException;
            expect(httpErr.status).toBe(409);
            expect(httpErr.message).toContain('RESUME_NOT_ALLOWED_CANCELLATION_SCHEDULED');
        }
        // The MP preapproval must NEVER be resumed for a cancelled subscription.
        expect(billing.subscriptions.resume).not.toHaveBeenCalled();
    });

    it('resumes the genuinely-paused sub and skips the soft-cancelled one when both exist', async () => {
        const softCancelled = {
            id: 'sub-softcancel-2',
            status: 'paused',
            metadata: {},
            cancelAtPeriodEnd: true
        };
        const resumable = {
            id: 'sub-paused-2',
            status: 'paused',
            metadata: {},
            cancelAtPeriodEnd: false
        };
        const billing = makeBillingMock([softCancelled, resumable]);
        mockBilling(billing);
        const ctx = createMockContext();

        const result = await handleSelfServeResume(ctx as never);

        expect(result.subscriptionId).toBe('sub-paused-2');
        expect(billing.subscriptions.resume).toHaveBeenCalledWith('sub-paused-2');
        expect(billing.subscriptions.resume).not.toHaveBeenCalledWith('sub-softcancel-2');
    });

    it('throws 404 when no paused subscription exists', async () => {
        mockBilling(makeBillingMock([{ id: 'sub-active', status: 'active', metadata: {} }]));
        const ctx = createMockContext();

        try {
            await handleSelfServeResume(ctx as never);
            throw new Error('expected handleSelfServeResume to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            expect((err as HTTPException).status).toBe(404);
        }
    });
});
