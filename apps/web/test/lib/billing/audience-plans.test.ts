/**
 * @file billing/audience-plans.test.ts
 * @description Unit tests for the five-audience model behind
 * `/suscriptores/planes/` (HOS-942 AC-1, AC-8, AC-9).
 *
 * These assert BEHAVIOUR, not page source. An `.astro` page cannot be rendered
 * in Vitest, so a source-reading test on `planes/index.astro` could only confirm
 * that a string is DECLARED there — never that five cards come out, never that a
 * failed fetch still yields a card. The page is therefore a thin `.map()` over
 * what this module returns, and the substance is asserted here where it can be
 * executed.
 *
 * `getApiUrl` is module-mocked to bypass `validateWebEnv()`, which reads
 * `import.meta.env` and is unavailable under jsdom — the pattern
 * `fetch-plans.test.ts` established.
 */

import { PARTNER_TIER_PLAN_SLUG } from '@repo/billing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    AUDIENCE_CARD_ORDER,
    AUDIENCE_CARD_PATHS,
    fetchAudienceOffers,
    formatStartingPriceArs,
    resolveAudienceStartingPrices,
    resolveAudienceTrialDays,
    resolveStartingPrice,
    selectAudiencePlans
} from '@/lib/billing/audience-plans';
import type { PublicPlanData } from '@/lib/billing/fetch-plans';

vi.mock('@/lib/env', () => ({
    getApiUrl: vi.fn(() => 'http://api.test')
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makePlan = (overrides: Partial<PublicPlanData> = {}): PublicPlanData => ({
    id: '00000000-0000-0000-0000-000000000001',
    slug: 'owner-basico',
    name: 'Básico',
    description: 'Plan básico',
    category: 'owner',
    monthlyPriceArs: 1_800_000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 18,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 1,
    isActive: true,
    entitlements: [],
    limits: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
});

const ok = (plans: readonly PublicPlanData[]) => ({ ok: true, plans }) as const;
const failed = (error = 'boom') => ({ ok: false, error }) as const;

/**
 * Trial lengths for the fixtures below — FOUR DIFFERENT NUMBERS, on purpose.
 *
 * The live catalogue currently sits at 30 days for four of the five audiences,
 * which makes it a terrible fixture: a bug that returned a fixed `30` would pass
 * against it on four cards out of five. Every audience here therefore gets its
 * own value, and none of them is 30, so the only implementation that satisfies
 * this file is one that genuinely reads each audience's own plans.
 */
const OWNER_TRIAL = 14;
const OWNER_LONGER_TRIAL = 21;
const TOURIST_TRIAL = 45;
const GASTRONOMY_TRIAL = 7;
const EXPERIENCE_TRIAL = 3;

/**
 * The accommodation-domain payload: owner tiers + tourist tiers in one list.
 *
 * `tourist-free` carries `hasTrial: false` exactly as the real catalogue does —
 * a plan that never expires has no trial to offer — and it is the case that
 * separates "the minimum of the plans that HAVE a trial" from "the minimum of
 * `trialDays`", which would answer 0 and take the line off the tourist card.
 */
const ACCOMMODATION_PLANS = [
    makePlan({
        slug: 'owner-basico',
        category: 'owner',
        monthlyPriceArs: 1_800_000,
        hasTrial: true,
        trialDays: OWNER_LONGER_TRIAL
    }),
    makePlan({
        slug: 'owner-pro',
        category: 'owner',
        monthlyPriceArs: 3_500_000,
        sortOrder: 2,
        hasTrial: true,
        trialDays: OWNER_TRIAL
    }),
    makePlan({ slug: 'tourist-free', category: 'tourist', monthlyPriceArs: 0 }),
    makePlan({
        slug: 'tourist-vip',
        category: 'tourist',
        monthlyPriceArs: 1_500_000,
        sortOrder: 3,
        hasTrial: true,
        trialDays: TOURIST_TRIAL
    })
];

const GASTRONOMY_PLANS = [
    makePlan({
        slug: 'gastronomy-basico',
        monthlyPriceArs: 1_000_000,
        hasTrial: true,
        trialDays: GASTRONOMY_TRIAL
    }),
    // Inactive, and carrying a SHORTER trial than the live plan: if `isActive`
    // stopped being checked, gastronomy would advertise 1 day.
    makePlan({
        slug: 'gastronomy-pro',
        monthlyPriceArs: 0,
        isActive: false,
        hasTrial: true,
        trialDays: 1
    })
];

const EXPERIENCE_PLANS = [
    makePlan({
        slug: 'experience-basico',
        monthlyPriceArs: 1_000_000,
        hasTrial: true,
        trialDays: EXPERIENCE_TRIAL
    })
];

const PARTNER_PLANS = [
    // The pre-tier plan: still active, but nobody can subscribe to it.
    makePlan({ slug: 'partner-listing', monthlyPriceArs: 500_000 }),
    makePlan({ slug: 'partner-silver', monthlyPriceArs: 1_500_000, sortOrder: 2 }),
    makePlan({ slug: 'partner-gold', monthlyPriceArs: 3_000_000, sortOrder: 3 })
];

const ALL_OK = {
    accommodation: ok(ACCOMMODATION_PLANS),
    gastronomy: ok(GASTRONOMY_PLANS),
    experience: ok(EXPERIENCE_PLANS),
    partner: ok(PARTNER_PLANS)
} as const;

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// The five audiences (AC-1, AC-9)
// ---------------------------------------------------------------------------

describe('audience card model', () => {
    it('declares exactly five audiences', () => {
        expect(AUDIENCE_CARD_ORDER).toHaveLength(5);
        expect([...AUDIENCE_CARD_ORDER]).toEqual([
            'host',
            'tourist',
            'gastronomy',
            'experience',
            'partner'
        ]);
    });

    it('keeps gastronomy and experience as two separate audiences (AC-9)', () => {
        // The retired `'commerce'` domain must not reappear as a joint card.
        expect(AUDIENCE_CARD_ORDER).toContain('gastronomy');
        expect(AUDIENCE_CARD_ORDER).toContain('experience');
        expect(AUDIENCE_CARD_ORDER).not.toContain('commerce');
        expect(AUDIENCE_CARD_PATHS.gastronomy).not.toBe(AUDIENCE_CARD_PATHS.experience);
    });

    it('routes every audience to its intended destination', () => {
        expect(AUDIENCE_CARD_PATHS).toEqual({
            host: 'suscriptores/planes/anfitriones',
            tourist: 'suscriptores/planes/turistas',
            gastronomy: 'publicar-restaurante',
            experience: 'publicar-experiencia',
            partner: 'sumate/partner'
        });
    });

    it('gives every audience a distinct destination', () => {
        const destinations = AUDIENCE_CARD_ORDER.map((id) => AUDIENCE_CARD_PATHS[id]);
        expect(new Set(destinations).size).toBe(destinations.length);
    });

    it('never sends a card back to the index it is rendered on', () => {
        for (const id of AUDIENCE_CARD_ORDER) {
            expect(AUDIENCE_CARD_PATHS[id]).not.toBe('suscriptores/planes');
        }
    });
});

// ---------------------------------------------------------------------------
// Starting price resolution (AC-8)
// ---------------------------------------------------------------------------

describe('resolveStartingPrice', () => {
    it('returns the cheapest ACTIVE plan', () => {
        expect(
            resolveStartingPrice({
                plans: [
                    makePlan({ slug: 'b', monthlyPriceArs: 3_500_000 }),
                    makePlan({ slug: 'a', monthlyPriceArs: 1_800_000 })
                ]
            })
        ).toEqual({ kind: 'from', monthlyPriceArs: 1_800_000 });
    });

    it('ignores inactive plans even when they are cheaper', () => {
        expect(
            resolveStartingPrice({
                plans: [
                    makePlan({ slug: 'cheap-but-off', monthlyPriceArs: 1, isActive: false }),
                    makePlan({ slug: 'live', monthlyPriceArs: 1_800_000 })
                ]
            })
        ).toEqual({ kind: 'from', monthlyPriceArs: 1_800_000 });
    });

    it('reports a zero-priced catalogue as free, not as "from $0"', () => {
        expect(resolveStartingPrice({ plans: [makePlan({ monthlyPriceArs: 0 })] })).toEqual({
            kind: 'free'
        });
    });

    it('returns null for an empty catalogue', () => {
        expect(resolveStartingPrice({ plans: [] })).toBeNull();
    });

    it('returns null when every plan is inactive', () => {
        expect(resolveStartingPrice({ plans: [makePlan({ isActive: false })] })).toBeNull();
    });

    it('ignores a plan whose price is not a usable number', () => {
        const broken = makePlan({ slug: 'broken' });
        // Simulates a malformed payload field surviving the untyped `as` cast
        // in `fetchPublicPlans`.
        const malformed = { ...broken, monthlyPriceArs: Number.NaN } as PublicPlanData;
        expect(
            resolveStartingPrice({
                plans: [malformed, makePlan({ slug: 'good', monthlyPriceArs: 900_000 })]
            })
        ).toEqual({ kind: 'from', monthlyPriceArs: 900_000 });
    });
});

describe('resolveAudienceStartingPrices', () => {
    it('resolves a price for all five audiences when every domain loads', () => {
        const prices = resolveAudienceStartingPrices(ALL_OK);

        expect(prices.host).toEqual({ kind: 'from', monthlyPriceArs: 1_800_000 });
        expect(prices.tourist).toEqual({ kind: 'free' });
        expect(prices.gastronomy).toEqual({ kind: 'from', monthlyPriceArs: 1_000_000 });
        expect(prices.experience).toEqual({ kind: 'from', monthlyPriceArs: 1_000_000 });
        // partner-listing (ARS 5.000) is active but unsellable — silver wins.
        expect(prices.partner).toEqual({ kind: 'from', monthlyPriceArs: 1_500_000 });
    });

    it('reads the sellable partner slugs from the canonical tier map', () => {
        const sellable = Object.values(PARTNER_TIER_PLAN_SLUG);
        expect(sellable).toContain('partner-silver');
        expect(sellable).not.toContain('partner-listing');
    });

    it('never surfaces a complex-tier price on the host card', () => {
        const prices = resolveAudienceStartingPrices({
            ...ALL_OK,
            accommodation: ok([
                ...ACCOMMODATION_PLANS,
                // Cheaper than every owner tier, and must still not be picked.
                makePlan({ slug: 'complex-basico', category: 'complex', monthlyPriceArs: 1 })
            ])
        });

        expect(prices.host).toEqual({ kind: 'from', monthlyPriceArs: 1_800_000 });
    });

    it('degrades ONE audience to null without disturbing the others (AC-8)', () => {
        const prices = resolveAudienceStartingPrices({ ...ALL_OK, gastronomy: failed() });

        expect(prices.gastronomy).toBeNull();
        expect(prices.host).not.toBeNull();
        expect(prices.tourist).not.toBeNull();
        expect(prices.experience).not.toBeNull();
        expect(prices.partner).not.toBeNull();
    });

    it('still answers for all five audiences when EVERY domain fails', () => {
        const prices = resolveAudienceStartingPrices({
            accommodation: failed(),
            gastronomy: failed(),
            experience: failed(),
            partner: failed()
        });

        // The keys are what the page maps over: five cards, no price on any.
        expect(Object.keys(prices).sort()).toEqual([...AUDIENCE_CARD_ORDER].sort());
        for (const id of AUDIENCE_CARD_ORDER) {
            expect(prices[id]).toBeNull();
        }
    });
});

// ---------------------------------------------------------------------------
// Trial resolution per audience (HOS-941 R-2)
// ---------------------------------------------------------------------------

describe('resolveAudienceTrialDays', () => {
    it('answers a DIFFERENT number for every audience that has a trial', () => {
        // The load-bearing test of the whole feature. Five audiences, five
        // distinct answers from one call: no constant, no default and no number
        // copied from a neighbouring card can satisfy this at once.
        //
        // It is written as a single `toEqual` rather than five assertions on
        // purpose — an implementation that resolved ONE audience correctly and
        // reused it for the rest would pass four separate `toBe` checks that
        // happened to expect the same value, and this shape cannot.
        expect(resolveAudienceTrialDays(ALL_OK)).toEqual({
            host: OWNER_TRIAL,
            tourist: TOURIST_TRIAL,
            gastronomy: GASTRONOMY_TRIAL,
            experience: EXPERIENCE_TRIAL,
            partner: null
        });
    });

    it('takes the SHORTEST trial when an audience’s plans disagree (host)', () => {
        // owner-basico offers 21 and owner-pro offers 14. A pre-selection
        // promise can only be as good as the worst plan the visitor might land
        // on: promising 21 and granting 14 is HOS-525 restated.
        expect(resolveAudienceTrialDays(ALL_OK).host).toBe(OWNER_TRIAL);
        expect(OWNER_TRIAL).toBeLessThan(OWNER_LONGER_TRIAL);
    });

    it('reports one number for an audience whose plans all agree', () => {
        // The uniform case, which is what the live owner catalogue looks like:
        // every tier on the same trial, and the answer is that trial.
        const uniform = resolveAudienceTrialDays({
            ...ALL_OK,
            accommodation: ok([
                makePlan({ slug: 'a', category: 'owner', hasTrial: true, trialDays: 12 }),
                makePlan({
                    slug: 'b',
                    category: 'owner',
                    sortOrder: 2,
                    hasTrial: true,
                    trialDays: 12
                }),
                makePlan({
                    slug: 'c',
                    category: 'owner',
                    sortOrder: 3,
                    hasTrial: true,
                    trialDays: 12
                })
            ])
        });

        expect(uniform.host).toBe(12);
    });

    it('does NOT let a no-trial plan drag its audience to zero (tourist)', () => {
        // The mixed case, and the one the real catalogue exhibits:
        // `tourist-free` has no trial (it never expires), `tourist-vip` has one.
        // Taking a naive `Math.min` over `trialDays` would answer 0 and the card
        // would lose its line entirely.
        const trials = resolveAudienceTrialDays(ALL_OK);

        expect(trials.tourist).toBe(TOURIST_TRIAL);
        expect(trials.tourist).not.toBe(0);
        // And it is not the host's number leaking sideways.
        expect(trials.tourist).not.toBe(trials.host);
    });

    it('returns null — never 0 — for an audience where nothing offers a trial', () => {
        // All three partner tiers sit at `hasTrial: false, trialDays: 0`. The
        // distinction matters at the render site: `null` means "no line", `0`
        // would mean "0 días de prueba", which is worse than saying nothing.
        const trials = resolveAudienceTrialDays(ALL_OK);

        expect(trials.partner).toBeNull();
        expect(trials.partner).not.toBe(0);
    });

    it('ignores a plan that claims trialDays without hasTrial, and vice versa', () => {
        // Both halves of the eligibility rule, each failing on its own.
        const trials = resolveAudienceTrialDays({
            ...ALL_OK,
            partner: ok([
                makePlan({ slug: 'partner-silver', hasTrial: false, trialDays: 30 }),
                makePlan({ slug: 'partner-gold', hasTrial: true, trialDays: 0, sortOrder: 2 })
            ])
        });

        expect(trials.partner).toBeNull();
    });

    it('never advertises a trial from a plan nobody can subscribe to', () => {
        // `partner-listing` is active but unsellable. If the trial were computed
        // over the raw domain instead of the sellable tiers, the partner card
        // would promise a trial that no purchasable plan grants.
        const trials = resolveAudienceTrialDays({
            ...ALL_OK,
            partner: ok([
                makePlan({ slug: 'partner-listing', hasTrial: true, trialDays: 90 }),
                makePlan({ slug: 'partner-silver', sortOrder: 2 }),
                makePlan({ slug: 'partner-gold', sortOrder: 3 })
            ])
        });

        expect(trials.partner).toBeNull();
    });

    it('ignores inactive plans even when they offer a shorter trial', () => {
        expect(resolveAudienceTrialDays(ALL_OK).gastronomy).toBe(GASTRONOMY_TRIAL);
    });

    it('never surfaces a complex-tier trial on the host card', () => {
        const trials = resolveAudienceTrialDays({
            ...ALL_OK,
            accommodation: ok([
                ...ACCOMMODATION_PLANS,
                // Shorter than every owner tier, and must still not be picked.
                makePlan({
                    slug: 'complex-basico',
                    category: 'complex',
                    hasTrial: true,
                    trialDays: 2
                })
            ])
        });

        expect(trials.host).toBe(OWNER_TRIAL);
    });

    it('degrades ONE audience to null without disturbing the others', () => {
        const trials = resolveAudienceTrialDays({ ...ALL_OK, gastronomy: failed() });

        expect(trials.gastronomy).toBeNull();
        expect(trials.host).toBe(OWNER_TRIAL);
        expect(trials.tourist).toBe(TOURIST_TRIAL);
        expect(trials.experience).toBe(EXPERIENCE_TRIAL);
    });

    it('still answers for all five audiences when EVERY domain fails', () => {
        const trials = resolveAudienceTrialDays({
            accommodation: failed(),
            gastronomy: failed(),
            experience: failed(),
            partner: failed()
        });

        expect(Object.keys(trials).sort()).toEqual([...AUDIENCE_CARD_ORDER].sort());
        for (const id of AUDIENCE_CARD_ORDER) {
            expect(trials[id]).toBeNull();
        }
    });
});

describe('selectAudiencePlans', () => {
    it('gives the price and the trial the exact same plans to read', () => {
        // The reason the selection is factored out at all: two readings of one
        // offer must not be able to disagree about which plans that offer is
        // made of. Asserted through the observable consequence — partner's
        // unsellable tier is excluded from BOTH readings by one rule.
        const selected = selectAudiencePlans(ALL_OK);

        expect(selected.partner.map((plan) => plan.slug)).toEqual([
            'partner-silver',
            'partner-gold'
        ]);
        expect(selected.host.every((plan) => plan.category === 'owner')).toBe(true);
        expect(selected.tourist.every((plan) => plan.category === 'tourist')).toBe(true);
        expect(Object.keys(selected).sort()).toEqual([...AUDIENCE_CARD_ORDER].sort());
    });

    it('shares no plan between two audiences', () => {
        const selected = selectAudiencePlans(ALL_OK);
        const seen = new Set<string>();

        for (const id of AUDIENCE_CARD_ORDER) {
            for (const plan of selected[id]) {
                expect(seen.has(plan.slug), `${plan.slug} appears in two audiences`).toBe(false);
                seen.add(plan.slug);
            }
        }
    });
});

// ---------------------------------------------------------------------------
// The four fetches (AC-8)
// ---------------------------------------------------------------------------

describe('fetchAudienceOffers', () => {
    /** Answer each `?domain=` (and the bare accommodation call) from a map. */
    const stubFetchByDomain = (byDomain: Record<string, readonly PublicPlanData[] | 'fail'>) => {
        global.fetch = vi.fn(async (url: unknown) => {
            const domain = new URL(String(url)).searchParams.get('domain') ?? 'accommodation';
            const payload = byDomain[domain];
            if (payload === undefined || payload === 'fail') {
                return { ok: false, status: 500 } as unknown as Response;
            }
            return {
                ok: true,
                json: async () => ({ success: true, data: payload })
            } as unknown as Response;
        }) as unknown as typeof fetch;
    };

    it('queries the accommodation, gastronomy, experience and partner domains', async () => {
        stubFetchByDomain({
            accommodation: ACCOMMODATION_PLANS,
            gastronomy: GASTRONOMY_PLANS,
            experience: EXPERIENCE_PLANS,
            partner: PARTNER_PLANS
        });

        const { startingPrices: prices } = await fetchAudienceOffers();

        // FOUR, not eight: price and trial are two readings of one catalogue,
        // so asking for both must not double the request count.
        expect(global.fetch).toHaveBeenCalledTimes(4);
        const requested = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
            .map((call) => String(call[0]))
            .sort();
        expect(requested).toEqual([
            'http://api.test/api/v1/public/plans',
            'http://api.test/api/v1/public/plans?domain=experience',
            'http://api.test/api/v1/public/plans?domain=gastronomy',
            'http://api.test/api/v1/public/plans?domain=partner'
        ]);
        expect(prices.host).toEqual({ kind: 'from', monthlyPriceArs: 1_800_000 });
    });

    it('keeps four audiences priced when one domain 500s', async () => {
        stubFetchByDomain({
            accommodation: ACCOMMODATION_PLANS,
            gastronomy: 'fail',
            experience: EXPERIENCE_PLANS,
            partner: PARTNER_PLANS
        });

        const { startingPrices: prices } = await fetchAudienceOffers();

        expect(prices.gastronomy).toBeNull();
        expect(prices.experience).toEqual({ kind: 'from', monthlyPriceArs: 1_000_000 });
    });

    it('resolves the trial from the SAME payload as the price', async () => {
        stubFetchByDomain({
            accommodation: ACCOMMODATION_PLANS,
            gastronomy: GASTRONOMY_PLANS,
            experience: EXPERIENCE_PLANS,
            partner: PARTNER_PLANS
        });

        const { startingPrices, trialDays } = await fetchAudienceOffers();

        // Host: priced AND trialled, both off the accommodation response.
        expect(startingPrices.host).toEqual({ kind: 'from', monthlyPriceArs: 1_800_000 });
        expect(trialDays.host).toBe(OWNER_TRIAL);
        // Partner: priced, NOT trialled. The two lines are independent, which is
        // the whole reason the card guards them separately.
        expect(startingPrices.partner).not.toBeNull();
        expect(trialDays.partner).toBeNull();
    });

    it('never rejects when the network itself throws', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

        await expect(fetchAudienceOffers()).resolves.toEqual({
            startingPrices: {
                host: null,
                tourist: null,
                gastronomy: null,
                experience: null,
                partner: null
            },
            trialDays: {
                host: null,
                tourist: null,
                gastronomy: null,
                experience: null,
                partner: null
            }
        });
    });
});

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

describe('formatStartingPriceArs', () => {
    it('renders cents as whole pesos with a currency symbol', () => {
        const formatted = formatStartingPriceArs({ cents: 1_800_000, intlLocale: 'es-AR' });

        expect(formatted).toContain('$');
        expect(formatted).toContain('18');
        expect(formatted).not.toContain(',00');
    });

    it('falls back to a plain peso string on an invalid locale tag', () => {
        expect(formatStartingPriceArs({ cents: 500_000, intlLocale: 'not a tag' })).toContain('$');
    });
});
