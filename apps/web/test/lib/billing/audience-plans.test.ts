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
    fetchAudienceStartingPrices,
    formatStartingPriceArs,
    resolveAudienceStartingPrices,
    resolveStartingPrice
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

/** The accommodation-domain payload: owner tiers + tourist tiers in one list. */
const ACCOMMODATION_PLANS = [
    makePlan({ slug: 'owner-basico', category: 'owner', monthlyPriceArs: 1_800_000 }),
    makePlan({ slug: 'owner-pro', category: 'owner', monthlyPriceArs: 3_500_000, sortOrder: 2 }),
    makePlan({ slug: 'tourist-free', category: 'tourist', monthlyPriceArs: 0 }),
    makePlan({ slug: 'tourist-vip', category: 'tourist', monthlyPriceArs: 1_500_000, sortOrder: 3 })
];

const GASTRONOMY_PLANS = [
    makePlan({ slug: 'gastronomy-basico', monthlyPriceArs: 1_000_000 }),
    makePlan({ slug: 'gastronomy-pro', monthlyPriceArs: 0, isActive: false })
];

const EXPERIENCE_PLANS = [makePlan({ slug: 'experience-basico', monthlyPriceArs: 1_000_000 })];

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
// The four fetches (AC-8)
// ---------------------------------------------------------------------------

describe('fetchAudienceStartingPrices', () => {
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

        const prices = await fetchAudienceStartingPrices();

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

        const prices = await fetchAudienceStartingPrices();

        expect(prices.gastronomy).toBeNull();
        expect(prices.experience).toEqual({ kind: 'from', monthlyPriceArs: 1_000_000 });
    });

    it('never rejects when the network itself throws', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

        await expect(fetchAudienceStartingPrices()).resolves.toEqual({
            host: null,
            tourist: null,
            gastronomy: null,
            experience: null,
            partner: null
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
