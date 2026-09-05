/**
 * HOS-1062 F1 / AC-13 — an unlisted plan never leaves `GET /api/v1/public/plans`.
 *
 * The endpoint is `skipAuth: true` and answers with full prices, so it is the
 * one surface where a negotiated agreement becomes a public fact. Nothing
 * reports that failure: the page renders, the response is well formed, and the
 * only symptom is that somebody read a municipality's price.
 *
 * What this suite pins is therefore not "the filter works" but "there is no
 * path through this handler that serves an unlisted plan" — including the
 * branch where the DOMAIN query fails, which for `accommodation` deliberately
 * fails OPEN (HOS-685). That asymmetry must not extend to the visibility mark,
 * and the two tests at the bottom are the ones that say so.
 */

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

const LISTED_ACCOMMODATION_PLAN = {
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
    publicListing: 'listed',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

/**
 * The plan this whole phase exists for: an ACTIVE, charging plan carrying a
 * negotiated price, which no public caller may enumerate. `isActive: true` is
 * the point — an unlisted plan is not a disabled one.
 */
const UNLISTED_PARTNER_PLAN = {
    ...LISTED_ACCOMMODATION_PLAN,
    id: '22222222-2222-2222-2222-222222222222',
    slug: 'partner-municipalidad-cdu',
    name: 'Acuerdo Municipalidad',
    monthlyPriceArs: 1,
    isActive: true,
    publicListing: 'unlisted'
};

/** A plan whose mark never arrived — the mapper-forgot / older-payload case. */
const UNMARKED_PLAN = (() => {
    const { publicListing: _publicListing, ...rest } = {
        ...LISTED_ACCOMMODATION_PLAN,
        id: '33333333-3333-3333-3333-333333333333',
        slug: 'owner-sin-marca'
    };
    return rest;
})();

const DOMAIN_BY_SLUG: Record<string, string> = {
    'owner-basico': 'accommodation',
    'partner-municipalidad-cdu': 'partner',
    'owner-sin-marca': 'accommodation'
};

function getHandler(): (ctx: unknown) => Promise<unknown> {
    const call = mockCreateSimpleRoute.mock.calls[0];
    return (call?.[0] as Record<string, unknown>)?.handler as (ctx: unknown) => Promise<unknown>;
}

/**
 * Answer the domain-exclusion query from the domain the ROUTE asked for, read
 * off the `ne()` condition it passed to `.where()` — same technique as
 * `listPlans.domain-scope.test.ts`, and for the same reason: a fixed row set
 * would let a handler that ignored `?domain=` stay green.
 */
function answerExclusionQueryFromCondition(
    condition: unknown
): Promise<Array<{ readonly name: string }>> {
    const requestedDomain = (condition as { val?: unknown })?.val;
    return Promise.resolve(
        Object.entries(DOMAIN_BY_SLUG)
            .filter(([, planDomain]) => planDomain !== requestedDomain)
            .map(([slug]) => ({ name: slug }))
    );
}

function servedSlugs(result: unknown): string[] {
    return (result as Array<{ slug: string }>).map((plan) => plan.slug);
}

describe('publicListPlansRoute — unlisted plans (HOS-1062 AC-13)', () => {
    beforeEach(() => {
        mockPlanList.mockReset();
        mockSelectWhere.mockReset();
        mockPlanList.mockResolvedValue({
            success: true,
            data: {
                items: [LISTED_ACCOMMODATION_PLAN, UNLISTED_PARTNER_PLAN, UNMARKED_PLAN],
                pagination: { page: 1, pageSize: 20, total: 3, totalPages: 1 }
            }
        });
    });

    describe('when the domain query answers normally', () => {
        beforeEach(() => {
            mockSelectWhere.mockImplementation(answerExclusionQueryFromCondition);
        });

        it('withholds an unlisted plan from the default (accommodation) list', async () => {
            const result = await getHandler()(makePublicPlansCtx());

            expect(servedSlugs(result)).not.toContain('partner-municipalidad-cdu');
        });

        it('withholds an unlisted plan from its OWN domain, where it would otherwise match', async () => {
            // The domain filter cannot help here: `?domain=partner` is exactly
            // the query that selects this plan. Only the visibility mark stops
            // it, so this is the assertion with no second line of defence.
            const result = await getHandler()(makePublicPlansCtx('partner'));

            expect(result).toEqual([]);
        });

        it('withholds a plan whose visibility mark never arrived', async () => {
            // Positive test (`=== 'listed'`), so a missing mark withholds rather
            // than publishes. Losing a plan from the catalogue is recoverable;
            // publishing a negotiated price is not.
            const result = await getHandler()(makePublicPlansCtx());

            expect(servedSlugs(result)).not.toContain('owner-sin-marca');
        });

        it('still serves the ordinary catalogue', async () => {
            // The other half: a lock that also locks out the catalogue is a
            // regression dressed as a security fix.
            const result = await getHandler()(makePublicPlansCtx());

            expect(result).toEqual([LISTED_ACCOMMODATION_PLAN]);
        });

        it('leaks no field of an unlisted plan, not just no whole row', async () => {
            const serialised = JSON.stringify(await getHandler()(makePublicPlansCtx('partner')));

            expect(serialised).not.toContain('partner-municipalidad-cdu');
            expect(serialised).not.toContain('Acuerdo Municipalidad');
        });
    });

    describe('when the domain query itself fails', () => {
        beforeEach(() => {
            mockSelectWhere.mockRejectedValue(new Error('connection reset'));
        });

        it('withholds the unlisted plan on the FAIL-OPEN branch (accommodation)', async () => {
            // HOS-685 makes `accommodation` serve an unfiltered list here rather
            // than break the pricing page. Unfiltered BY DOMAIN — never by
            // visibility. This is the branch AC-13's second sentence names, and
            // the one an implementation inherits by accident.
            const result = await getHandler()(makePublicPlansCtx());

            expect(servedSlugs(result)).not.toContain('partner-municipalidad-cdu');
            expect(servedSlugs(result)).not.toContain('owner-sin-marca');
            expect(result).toEqual([LISTED_ACCOMMODATION_PLAN]);
        });

        it('withholds the unlisted plan on the FAIL-CLOSED branch (any other domain)', async () => {
            const result = await getHandler()(makePublicPlansCtx('partner'));

            expect(result).toEqual([]);
        });
    });

    describe('when the plan service itself fails', () => {
        it('answers an empty list rather than anything unfiltered', async () => {
            mockPlanList.mockResolvedValue({ success: false, error: { message: 'db down' } });
            mockSelectWhere.mockImplementation(answerExclusionQueryFromCondition);

            const result = await getHandler()(makePublicPlansCtx());

            expect(result).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // The catalogue window (HOS-1062 — adversarial review finding)
    // -----------------------------------------------------------------------
    describe('reading the catalogue before filtering it', () => {
        beforeEach(() => {
            mockSelectWhere.mockImplementation(answerExclusionQueryFromCondition);
        });

        it('asks for a full catalogue page instead of taking the default twenty', async () => {
            // The bug: `list({ active: true })` took `listPlans`' DEFAULT page of
            // 20 and filtered THOSE in memory. Harmless while the catalogue was a
            // fixed six; this spec's premise is one plan row per negotiated
            // agreement, so the catalogue now grows with the customers — and a
            // truncated public list is cached for an hour with no error and no log.
            await getHandler()(makePublicPlansCtx());

            expect(mockPlanList).toHaveBeenCalledWith({
                active: true,
                page: 1,
                pageSize: 100
            });
        });

        it('walks every page before filtering, so a plan past the first page still serves', async () => {
            // Two pages, with the unlisted plan on the first and an ordinary
            // catalogue plan on the second. Filtering per page would have served
            // page one only and dropped `owner-segunda-pagina` outright.
            const SECOND_PAGE_PLAN = {
                ...LISTED_ACCOMMODATION_PLAN,
                id: '44444444-4444-4444-4444-444444444444',
                slug: 'owner-segunda-pagina'
            };
            DOMAIN_BY_SLUG['owner-segunda-pagina'] = 'accommodation';

            mockPlanList.mockReset();
            mockPlanList
                .mockResolvedValueOnce({
                    success: true,
                    data: {
                        items: [LISTED_ACCOMMODATION_PLAN, UNLISTED_PARTNER_PLAN],
                        pagination: { page: 1, pageSize: 100, total: 3, totalPages: 2 }
                    }
                })
                .mockResolvedValueOnce({
                    success: true,
                    data: {
                        items: [SECOND_PAGE_PLAN],
                        pagination: { page: 2, pageSize: 100, total: 3, totalPages: 2 }
                    }
                });

            const result = await getHandler()(makePublicPlansCtx());

            expect(mockPlanList).toHaveBeenNthCalledWith(1, {
                active: true,
                page: 1,
                pageSize: 100
            });
            expect(mockPlanList).toHaveBeenNthCalledWith(2, {
                active: true,
                page: 2,
                pageSize: 100
            });
            expect(servedSlugs(result)).toEqual(['owner-basico', 'owner-segunda-pagina']);
            expect(servedSlugs(result)).not.toContain('partner-municipalidad-cdu');

            delete DOMAIN_BY_SLUG['owner-segunda-pagina'];
        });

        it('serves nothing when a later page fails, never a silently short catalogue', async () => {
            // A partial catalogue is indistinguishable from a complete one at the
            // caller, so it is never handed back. Losing the list for one request
            // is recoverable; publishing a list that quietly lost rows is not
            // even noticed.
            mockPlanList.mockReset();
            mockPlanList
                .mockResolvedValueOnce({
                    success: true,
                    data: {
                        items: [LISTED_ACCOMMODATION_PLAN],
                        pagination: { page: 1, pageSize: 100, total: 2, totalPages: 2 }
                    }
                })
                .mockResolvedValueOnce({ success: false, error: { message: 'connection reset' } });

            const result = await getHandler()(makePublicPlansCtx());

            expect(result).toEqual([]);
        });
    });
});
