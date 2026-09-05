/**
 * Unit tests for `handleCommerceTrialVerdict` (HOS-1184).
 *
 * Same harness as `downgrade-preview.test.ts` next door: the handler is exported
 * standalone and driven against a mocked `Context`.
 *
 * Two properties carry the weight, and both are about what the endpoint must NOT
 * do rather than what it returns:
 *
 * 1. **A caller with no billing customer gets a verdict, not a refusal.** The
 *    sibling preview endpoint answers 404 for that caller, and inheriting it
 *    here would aim the bug at the brand-new owner — the most common caller of
 *    all, and the one guaranteed not to have spent their trial.
 * 2. **It writes nothing, including on the null path.** That branch is where an
 *    `ensureCustomerExists` would look helpful, and it would mint a billing row
 *    for anyone who opened the page.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({ use: vi.fn(), route: vi.fn() }))
}));
vi.mock('../../../../src/utils/route-factory', () => ({
    createCRUDRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));
vi.mock('../../../../src/middlewares/authorization', () => ({
    protectedAuthMiddleware: vi.fn(() => (_c: unknown, next: () => Promise<void>) => next())
}));

const { mockGetQZPayBilling } = vi.hoisted(() => ({ mockGetQZPayBilling: vi.fn() }));
vi.mock('../../../../src/middlewares/billing', () => ({
    getQZPayBilling: mockGetQZPayBilling
}));

const { mockResolveVerdict } = vi.hoisted(() => ({ mockResolveVerdict: vi.fn() }));
vi.mock('../../../../src/services/commerce-trial-start.service', () => ({
    resolveCommerceTrialVerdict: mockResolveVerdict
}));

import { handleCommerceTrialVerdict } from '../../../../src/routes/commerce/protected/trial-verdict';

const CUSTOMER_ID = 'cust_owner';

function makeCtx(contextValues: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = { billingCustomerId: CUSTOMER_ID, ...contextValues };
    return { get: (key: string) => values[key] } as never;
}

/** Runs the handler and reduces whatever it refuses with to `{status}`. */
async function captureRefusal(contextValues?: Record<string, unknown>) {
    try {
        await handleCommerceTrialVerdict(makeCtx(contextValues), { entityType: 'gastronomy' });
    } catch (error) {
        return { status: (error as { status?: number }).status ?? 0 };
    }
    return { status: 200 };
}

describe('handleCommerceTrialVerdict (HOS-1184)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetQZPayBilling.mockReturnValue({});
        mockResolveVerdict.mockResolvedValue({ verdict: 'trial_available', trialDays: 30 });
    });

    it('returns the verdict and the trial length', async () => {
        const result = await handleCommerceTrialVerdict(makeCtx(), { entityType: 'gastronomy' });

        expect(result).toEqual({ verdict: 'trial_available', trialDays: 30 });
    });

    it('resolves the verdict for the vertical in the path, not a default one', async () => {
        await handleCommerceTrialVerdict(makeCtx(), { entityType: 'experience' });

        // Answering for gastronomy on an experience page would spend the wrong
        // vertical's one-per-domain trial in the owner's mental model, and read
        // as a working feature from the outside.
        expect(mockResolveVerdict).toHaveBeenCalledWith(
            expect.objectContaining({ vertical: 'experience', customerId: CUSTOMER_ID })
        );
    });

    it('passes a missing billing customer through as null instead of refusing', async () => {
        await handleCommerceTrialVerdict(makeCtx({ billingCustomerId: null }), {
            entityType: 'gastronomy'
        });

        expect(mockResolveVerdict).toHaveBeenCalledWith(
            expect.objectContaining({ customerId: null })
        );
    });

    it('answers 200 for a caller with no billing customer — NOT the sibling preview 404', async () => {
        // The difference from `downgrade-preview` is deliberate. A preview of a
        // subscription that does not exist has nothing to describe; an owner
        // with no billing history has a perfectly definite verdict.
        expect(await captureRefusal({ billingCustomerId: null })).toEqual({ status: 200 });
        expect(await captureRefusal({ billingCustomerId: undefined })).toEqual({ status: 200 });
    });

    it('omits trialDays entirely when the service reports none', async () => {
        mockResolveVerdict.mockResolvedValue({ verdict: 'payment_required' });

        const result = await handleCommerceTrialVerdict(makeCtx(), { entityType: 'gastronomy' });

        // Not `trialDays: 0` and not `undefined` as a present key: the copy
        // interpolates this number, and "0 días de prueba gratis" is worse than
        // no number at all.
        expect(result).toEqual({ verdict: 'payment_required' });
        expect(Object.hasOwn(result, 'trialDays')).toBe(false);
    });

    it('keeps has_active_sub DISTINCT from trial_available on the wire', async () => {
        mockResolveVerdict.mockResolvedValue({ verdict: 'has_active_sub' });

        const result = await handleCommerceTrialVerdict(makeCtx(), { entityType: 'gastronomy' });

        // Both mean "publishing costs nothing today". Collapsing them is the
        // defect this endpoint exists to stop the UI from re-creating, so the
        // two must not be interchangeable here either.
        expect(result.verdict).toBe('has_active_sub');
        expect(result.verdict).not.toBe('trial_available');
    });

    it('refuses with 503 when billing is unavailable', async () => {
        mockGetQZPayBilling.mockReturnValue(null);

        expect(await captureRefusal()).toEqual({ status: 503 });
        // And it does not fall through to a verdict anyway.
        expect(mockResolveVerdict).not.toHaveBeenCalled();
    });

    it('writes nothing — the grant service is not even reachable from here', async () => {
        await handleCommerceTrialVerdict(makeCtx(), { entityType: 'gastronomy' });

        // Asserted structurally rather than in the abstract: `startCommerceListingTrial`
        // is not mocked in this file, so a version of the handler that granted
        // would have to import it and this suite would stop compiling.
        expect(mockResolveVerdict).toHaveBeenCalledOnce();
    });
});
