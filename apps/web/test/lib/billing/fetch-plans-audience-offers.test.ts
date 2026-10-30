/** Tests the four vertical reads used by the public plan index. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAudienceOffers, formatStartingPriceArs } from '@/lib/billing/audience-plans';

vi.mock('@/lib/env', () => ({ getApiUrl: vi.fn(() => 'http://api.test') }));

const VERTICALS = ['accommodation', 'tourist', 'venue', 'experience'] as const;
type Vertical = (typeof VERTICALS)[number];

function plan(slug: string, trialDays: number, amount: number) {
    return {
        planId: '10000000-0000-4000-8000-000000000001',
        planVersionId: '10000000-0000-4000-8000-000000000002',
        slug,
        name: slug,
        description: null,
        pricingOrder: 1,
        rank: 1,
        trialDays,
        inheritsTouristVip: false,
        entitlements: [],
        limits: {},
        billingOptions: [
            {
                id: '10000000-0000-4000-8000-000000000003',
                cycle: 'monthly',
                amount,
                currency: 'ARS'
            }
        ]
    };
}

function stubCatalogs(options: { readonly failedVertical?: Vertical } = {}): void {
    global.fetch = vi.fn(async (input: unknown) => {
        const vertical = new URL(String(input)).searchParams.get('vertical') as Vertical;
        if (vertical === options.failedVertical) return { ok: false, status: 503 } as Response;
        // Each sellable plan carries its own (ignored) trial_days of 99; the
        // trial comes from the API's per-vertical trialOffer (HOS-1967).
        const records: Record<Vertical, ReturnType<typeof plan>> = {
            accommodation: plan('host', 99, 1800000),
            tourist: plan('tourist', 99, 150000),
            venue: plan('venue', 99, 1000000),
            experience: plan('experience', 99, 1200000)
        };
        const trialOffers: Record<Vertical, { trialDays: number } | null> = {
            accommodation: { trialDays: 14 },
            tourist: null,
            venue: { trialDays: 7 },
            experience: { trialDays: 3 }
        };
        return {
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    vertical,
                    plans: [records[vertical]],
                    floor: null,
                    trialOffer: trialOffers[vertical]
                }
            })
        } as Response;
    }) as typeof fetch;
}

afterEach(() => vi.restoreAllMocks());

describe('fetchAudienceOffers', () => {
    it('reads each vertical once, including tourist (AC:B13a:11)', async () => {
        stubCatalogs();
        const { startingPrices } = await fetchAudienceOffers();
        const calls = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
        expect(calls).toHaveLength(4);
        expect(calls.map(([url]) => String(url)).sort()).toEqual(
            VERTICALS.map(
                (vertical) => `http://api.test/api/v1/public/plan-catalog?vertical=${vertical}`
            ).sort()
        );
        expect(startingPrices.host).toEqual({ kind: 'from', monthlyPriceArs: 1800000 });
        expect(startingPrices.tourist).toEqual({ kind: 'from', monthlyPriceArs: 150000 });
    });

    it('keeps other audiences when one vertical fails', async () => {
        stubCatalogs({ failedVertical: 'venue' });
        const { startingPrices } = await fetchAudienceOffers();
        expect(startingPrices.venue).toBeNull();
        expect(startingPrices.experience).toEqual({ kind: 'from', monthlyPriceArs: 1200000 });
    });

    it('derives price and trial from the same vertical response', async () => {
        stubCatalogs();
        const { startingPrices, trialDays } = await fetchAudienceOffers();
        expect(startingPrices.host).toEqual({ kind: 'from', monthlyPriceArs: 1800000 });
        expect(trialDays.host).toBe(14);
        expect(startingPrices.tourist).toEqual({ kind: 'from', monthlyPriceArs: 150000 });
        expect(trialDays.tourist).toBeNull();
        expect(trialDays.venue).toBe(7);
    });

    it('degrades every audience when the network throws', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('offline'));
        await expect(fetchAudienceOffers()).resolves.toEqual({
            startingPrices: { host: null, tourist: null, venue: null, experience: null },
            trialDays: { host: null, tourist: null, venue: null, experience: null }
        });
    });
});

describe('formatStartingPriceArs', () => {
    it('renders cents as whole pesos with a currency symbol', () => {
        const formatted = formatStartingPriceArs({ cents: 1800000, intlLocale: 'es-AR' });
        expect(formatted).toContain('$');
        expect(formatted).toContain('18');
        expect(formatted).not.toContain(',00');
    });

    it('falls back to a plain peso string on an invalid locale tag', () => {
        expect(formatStartingPriceArs({ cents: 500000, intlLocale: 'not a tag' })).toContain('$');
    });
});
