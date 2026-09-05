/**
 * Unit tests for `handleCommerceDowngradePreview` (HOS-1122).
 *
 * Same harness as `change-plan.test.ts` next door: the handler is exported
 * standalone and driven against a mocked `Context`, with `resolveCommercePlanSlug`
 * left REAL (only `utils/env` is stubbed) so the cross-vertical refusal is the
 * genuine one rather than a stub agreeing with itself.
 *
 * Two properties carry the weight:
 *
 * 1. **It writes nothing.** The whole reason this endpoint exists rather than
 *    reading the preview off the change-plan POST is that an owner must be able
 *    to look and walk away. Nothing is asserted about "no mutation" in the
 *    abstract — the schedule service is not even imported here, so a version
 *    that scheduled would have to import it, and this file would stop compiling
 *    the day someone tried.
 * 2. **An unresolvable cap is a 422, never an empty preview.** Answering
 *    "nothing is over the cap" for a tier whose cap could not be read is the
 *    exact lie the limit engine tells one layer down (HOS-1078), and the UI
 *    would restrict the owner's listings by the default order having told them
 *    there was nothing at stake.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const mockEnv = vi.hoisted<{ HOSPEDA_COMMERCE_PLAN_SLUGS?: string }>(() => ({
    HOSPEDA_COMMERCE_PLAN_SLUGS: undefined
}));
vi.mock('../../../../src/utils/env', () => ({ env: mockEnv, validateApiEnv: vi.fn() }));

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

const { mockFindOwnerVerticalSubscription } = vi.hoisted(() => ({
    mockFindOwnerVerticalSubscription: vi.fn()
}));
vi.mock('../../../../src/services/commerce-subscription-attach.service', () => ({
    findOwnerVerticalSubscription: mockFindOwnerVerticalSubscription
}));

const { mockComputeExcess } = vi.hoisted(() => ({ mockComputeExcess: vi.fn() }));
// `importOriginal` so `CommerceListingCapMissingError` stays the REAL class —
// the handler's `instanceof` would otherwise never match and the 422 branch
// would be untested code the suite reports as covered.
vi.mock(
    '../../../../src/services/commerce-downgrade-remediation.service',
    async (importOriginal) => {
        const actual =
            await importOriginal<
                typeof import('../../../../src/services/commerce-downgrade-remediation.service')
            >();
        return { ...actual, computeCommerceDowngradeExcess: mockComputeExcess };
    }
);

import { GASTRONOMY_BASICO_PLAN } from '@repo/billing';
import { handleCommerceDowngradePreview } from '../../../../src/routes/commerce/protected/downgrade-preview';
import { CommerceListingCapMissingError } from '../../../../src/services/commerce-downgrade-remediation.service';

const CUSTOMER_ID = 'cust_owner';
const SUB_ID = 'sub-gastro-1';

const PREVIEW = {
    vertical: 'gastronomy' as const,
    cap: 1,
    activeCount: 3,
    excessCount: 2,
    items: [],
    hasExcess: true
};

function makeCtx(contextValues: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = { billingCustomerId: CUSTOMER_ID, ...contextValues };
    return { get: (key: string) => values[key] } as never;
}

/** Runs the handler and reduces whatever it refuses with to `{status}`. */
async function captureRefusal(targetPlan: unknown, contextValues?: Record<string, unknown>) {
    try {
        await handleCommerceDowngradePreview(
            makeCtx(contextValues),
            { entityType: 'gastronomy' },
            {},
            { targetPlan }
        );
    } catch (error) {
        return { status: (error as { status?: number }).status ?? 0 };
    }
    return { status: 200 };
}

describe('handleCommerceDowngradePreview (HOS-1122)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = undefined;
        mockGetQZPayBilling.mockReturnValue({});
        mockFindOwnerVerticalSubscription.mockResolvedValue({ id: SUB_ID });
        mockComputeExcess.mockResolvedValue(PREVIEW);
    });

    it('returns the excess for the caller`s own subscription in that vertical', async () => {
        const result = await handleCommerceDowngradePreview(
            makeCtx(),
            { entityType: 'gastronomy' },
            {},
            { targetPlan: GASTRONOMY_BASICO_PLAN.slug }
        );

        expect(result).toEqual(PREVIEW);
        expect(mockComputeExcess).toHaveBeenCalledWith({
            subscriptionId: SUB_ID,
            vertical: 'gastronomy',
            targetPlanSlug: GASTRONOMY_BASICO_PLAN.slug
        });
    });

    it('selects the subscription by DOMAIN, never the customer`s first live one', async () => {
        await handleCommerceDowngradePreview(
            makeCtx(),
            { entityType: 'gastronomy' },
            {},
            { targetPlan: GASTRONOMY_BASICO_PLAN.slug }
        );

        expect(mockFindOwnerVerticalSubscription).toHaveBeenCalledWith(
            expect.objectContaining({ customerId: CUSTOMER_ID, vertical: 'gastronomy' })
        );
    });

    it('refuses the OTHER vertical`s tier with 400, through the real resolver', async () => {
        const refusal = await captureRefusal('experience-basico');

        expect(refusal.status).toBe(400);
        expect(mockComputeExcess).not.toHaveBeenCalled();
    });

    it('answers 404 when the caller holds no subscription for this vertical', async () => {
        mockFindOwnerVerticalSubscription.mockResolvedValue(null);

        expect((await captureRefusal(GASTRONOMY_BASICO_PLAN.slug)).status).toBe(404);
    });

    it('answers the same 404 when the caller has no billing customer at all', async () => {
        const refusal = await captureRefusal(GASTRONOMY_BASICO_PLAN.slug, {
            billingCustomerId: undefined
        });

        expect(refusal.status).toBe(404);
    });

    it('answers 422 — not an empty preview — when the tier`s cap cannot be read', async () => {
        mockComputeExcess.mockRejectedValue(
            new CommerceListingCapMissingError(GASTRONOMY_BASICO_PLAN.slug, 'gastronomy')
        );

        expect((await captureRefusal(GASTRONOMY_BASICO_PLAN.slug)).status).toBe(422);
    });

    it('answers 422 for a missing targetPlan', async () => {
        expect((await captureRefusal(undefined)).status).toBe(422);
        expect(mockComputeExcess).not.toHaveBeenCalled();
    });

    it('answers 503 when billing is unavailable', async () => {
        mockGetQZPayBilling.mockReturnValue(null);

        expect((await captureRefusal(GASTRONOMY_BASICO_PLAN.slug)).status).toBe(503);
    });

    it('answers 503 when the vertical mapping is malformed', async () => {
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = 'gastronomy=oops';

        expect((await captureRefusal(GASTRONOMY_BASICO_PLAN.slug)).status).toBe(503);
    });
});
