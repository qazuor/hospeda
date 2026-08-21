/**
 * HOS-685 AC-22 — `GET /api/v1/public/plans` gains `?domain=`.
 *
 * Two claims are under test, and the first one is the release's whole safety
 * argument: **without the parameter the endpoint answers exactly what it
 * answers today**. Every caller that exists — the pricing pages, the plan
 * comparison, the browser cache keyed on the bare URL — sends no `domain`, so a
 * drift here would be a live regression dressed as a new feature.
 *
 * The second is the feature: a domain-scoped list never mixes domains.
 *
 * Note on AC-22's second half: `?domain=gastronomy` returning "that vertical's
 * plan" is only observable once release B (HOS-692) writes rows carrying the new
 * values. In release A the catalogue holds none, so what is asserted here is the
 * filter's behaviour against a stubbed plan set — the end-to-end assertion
 * belongs to B.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPlanList, mockCreateSimpleRoute, mockSelectWhere } = vi.hoisted(() => ({
    mockPlanList: vi.fn(),
    mockCreateSimpleRoute: vi.fn(),
    mockSelectWhere: vi.fn()
}));

vi.mock('../../../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(function () {
        return {
            list: mockPlanList
        };
    })
}));

vi.mock('../../../../src/utils/route-factory.js', () => ({
    createSimpleRoute: mockCreateSimpleRoute
}));

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: mockSelectWhere
            }))
        }))
    })),
    billingPlans: { name: 'name', productDomain: 'product_domain' },
    ne: vi.fn((col: unknown, val: unknown) => ({ op: 'ne', col, val }))
}));

import '../../../../src/routes/billing/public/listPlans';

import { makePublicPlansCtx } from './public-plans-test-ctx';

const ACCOMMODATION_PLAN = {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'owner-basico',
    name: 'Básico',
    description: 'Plan básico',
    category: 'owner' as const,
    monthlyPriceArs: 500000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 5,
    hasTrial: false,
    trialDays: 0,
    isDefault: true,
    sortOrder: 1,
    entitlements: [],
    limits: {},
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

const GASTRONOMY_PLAN = {
    ...ACCOMMODATION_PLAN,
    id: '22222222-2222-2222-2222-222222222222',
    slug: 'gastronomy-listing',
    name: 'Gastronomía'
};

const PARTNER_PLAN = {
    ...ACCOMMODATION_PLAN,
    id: '33333333-3333-3333-3333-333333333333',
    slug: 'partner-listing',
    name: 'Partner Listing'
};

const ALL_PLANS = [ACCOMMODATION_PLAN, GASTRONOMY_PLAN, PARTNER_PLAN];

function getHandler(): (ctx: unknown) => Promise<unknown> {
    const call = mockCreateSimpleRoute.mock.calls[0];
    return (call?.[0] as Record<string, unknown>)?.handler as (ctx: unknown) => Promise<unknown>;
}

const DOMAIN_BY_SLUG: Record<string, string> = {
    'owner-basico': 'accommodation',
    'gastronomy-listing': 'gastronomy',
    'partner-listing': 'partner'
};

/**
 * Answer the exclusion query using the domain the ROUTE actually asked for,
 * read off the `ne()` condition it passed to `.where()`.
 *
 * Stubbing a fixed row set per test instead would make every assertion below
 * vacuous: the suite would feed the expected answer regardless of which domain
 * the handler filtered by, so a handler that ignored `?domain=` entirely would
 * stay green. Verified by mutation — pinning the rows let 4 of these 6 tests
 * pass with the parameter thrown away.
 */
function answerExclusionQueryFromCondition(condition: unknown): Promise<Array<{ name: string }>> {
    const requestedDomain = (condition as { val?: unknown })?.val;
    return Promise.resolve(
        ALL_PLANS.filter((plan) => DOMAIN_BY_SLUG[plan.slug] !== requestedDomain).map((plan) => ({
            name: plan.slug
        }))
    );
}

describe('publicListPlansRoute — ?domain= scoping (HOS-685 AC-22)', () => {
    beforeEach(() => {
        mockPlanList.mockReset();
        mockSelectWhere.mockReset();
        mockPlanList.mockResolvedValue({
            success: true,
            data: {
                items: ALL_PLANS,
                pagination: { page: 1, pageSize: 20, total: ALL_PLANS.length, totalPages: 1 }
            }
        });
    });

    it("returns exactly today's response when no domain is given", async () => {
        // Arrange — the default resolves to accommodation, so everything else is excluded.
        mockSelectWhere.mockImplementation(answerExclusionQueryFromCondition);

        // Act
        const result = await getHandler()(makePublicPlansCtx());

        // Assert
        expect(result).toEqual([ACCOMMODATION_PLAN]);
    });

    it('answers an explicit ?domain=accommodation identically to no parameter', async () => {
        // Arrange
        mockSelectWhere.mockImplementation(answerExclusionQueryFromCondition);

        // Act
        const explicit = await getHandler()(makePublicPlansCtx('accommodation'));

        // Assert
        expect(explicit).toEqual([ACCOMMODATION_PLAN]);
    });

    it('returns that vertical and no accommodation plan for ?domain=gastronomy', async () => {
        // Arrange
        mockSelectWhere.mockImplementation(answerExclusionQueryFromCondition);

        // Act
        const result = (await getHandler()(makePublicPlansCtx('gastronomy'))) as typeof ALL_PLANS;

        // Assert — the vertical, and nothing from another domain.
        expect(result).toEqual([GASTRONOMY_PLAN]);
        expect(result).not.toContainEqual(ACCOMMODATION_PLAN);
        expect(result).not.toContainEqual(PARTNER_PLAN);
    });

    it('never mixes domains, whichever domain is requested', async () => {
        for (const [domain, expected] of [
            ['accommodation', ACCOMMODATION_PLAN],
            ['gastronomy', GASTRONOMY_PLAN],
            ['partner', PARTNER_PLAN]
        ] as const) {
            // Arrange
            mockSelectWhere.mockImplementation(answerExclusionQueryFromCondition);

            // Act
            const result = await getHandler()(makePublicPlansCtx(domain));

            // Assert
            expect(result).toEqual([expected]);
        }
    });

    it('rejects an unrecognised domain instead of answering an empty list', async () => {
        // Arrange — a typo must be loud. A silent empty catalogue is the failure
        // mode this whole vocabulary change exists to stop being possible.
        mockSelectWhere.mockResolvedValue([]);

        // Act / Assert
        await expect(getHandler()(makePublicPlansCtx('gastronomia'))).rejects.toThrow(
            /gastronomia/
        );
    });

    it('rejects the retired commerce value instead of answering an empty list', async () => {
        // Arrange — `commerce` was the pre-HOS-685 transitional value, kept
        // accepted through releases A/B so the old and new vocabularies could
        // overlap while the data migration was reversible. Release C
        // (HOS-695) removes the enum member itself, so `?domain=commerce` is
        // now exactly as invalid as any other unrecognised string — a 400,
        // not a silent empty catalogue.
        mockSelectWhere.mockResolvedValue([]);

        // Act / Assert
        const error = await getHandler()(makePublicPlansCtx('commerce')).catch((e) => e);

        expect(error).toBeInstanceOf(ServiceError);
        expect((error as ServiceError).code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect((error as ServiceError).message).toMatch(/commerce/);
    });

    describe('when the domain query itself fails', () => {
        beforeEach(() => {
            mockSelectWhere.mockRejectedValue(new Error('connection reset'));
        });

        it('keeps the pre-HOS-685 fail-open behaviour for the default domain', async () => {
            // A public pricing page that renders nothing is worse than one that
            // briefly shows a plan it should have filtered. This is the behaviour
            // the endpoint has today, preserved deliberately.
            const result = await getHandler()(makePublicPlansCtx());

            expect(result).toEqual(ALL_PLANS);
        });

        it('fails closed for any other domain rather than mixing them', async () => {
            // AC-22 forbids a mixed response outright, so a vertical falls back to
            // an empty list instead of inheriting accommodation's fail-open.
            const result = await getHandler()(makePublicPlansCtx('gastronomy'));

            expect(result).toEqual([]);
        });
    });
});
