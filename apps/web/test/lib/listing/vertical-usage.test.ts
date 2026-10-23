/** @file TEST:1757:1-4,6 per-vertical usage and upgrade destination contract. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { OwnerListingSummary } from '@repo/schemas';
import { LimitKeyEnum, PublicationStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectiveSetApi } from '@/lib/api/endpoints-protected';
import type { EntitlementsData } from '@/lib/entitlements-cache';
import {
    buildListingUsage,
    fetchListingEffectiveSets,
    resolveUsageUpgradePath
} from '@/lib/listing/vertical-usage';

vi.mock('@/lib/api/endpoints-protected', () => ({ effectiveSetApi: { get: vi.fn() } }));

const listing = (
    vertical: 'gastronomy' | 'experience',
    status: PublicationStatusEnum
): OwnerListingSummary => ({ vertical, publicationStatus: status }) as OwnerListingSummary;
const effective = (limits: Readonly<Record<string, number>>, failed = false): EntitlementsData => ({
    entitlements: {},
    limits,
    hasLiveNonTrialTitle: true,
    failed
});

describe('vertical usage — TEST:1757:1-4,6', () => {
    beforeEach(() => vi.clearAllMocks());

    it('TEST:1757:1 counts only published listings against the effective vertical cap', () => {
        const result = buildListingUsage({
            vertical: 'gastronomy',
            effectiveSet: effective({ [LimitKeyEnum.MAX_GASTRONOMIES]: 3 }),
            listings: [
                listing('gastronomy', PublicationStatusEnum.PUBLISHED),
                listing('gastronomy', PublicationStatusEnum.DRAFT),
                listing('gastronomy', PublicationStatusEnum.PURGED)
            ]
        });
        expect(result).toEqual({
            vertical: 'gastronomy',
            currentUsage: 1,
            maxAllowed: 3,
            threshold: 'ok'
        });
    });

    it('TEST:1757:2 reads each vertical independently', () => {
        const listings = [
            listing('gastronomy', PublicationStatusEnum.PUBLISHED),
            listing('gastronomy', PublicationStatusEnum.PUBLISHED),
            listing('experience', PublicationStatusEnum.PUBLISHED)
        ];
        expect(
            buildListingUsage({
                vertical: 'gastronomy',
                effectiveSet: effective({
                    [LimitKeyEnum.MAX_GASTRONOMIES]: 3,
                    [LimitKeyEnum.MAX_EXPERIENCES]: 8
                }),
                listings
            })?.currentUsage
        ).toBe(2);
        expect(
            buildListingUsage({
                vertical: 'experience',
                effectiveSet: effective({
                    [LimitKeyEnum.MAX_GASTRONOMIES]: 3,
                    [LimitKeyEnum.MAX_EXPERIENCES]: 8
                }),
                listings
            })?.currentUsage
        ).toBe(1);
    });

    it.each([
        ['failed', effective({ [LimitKeyEnum.MAX_GASTRONOMIES]: 3 }, true)],
        ['missing limit', effective({})],
        ['infinite', effective({ [LimitKeyEnum.MAX_GASTRONOMIES]: Infinity })],
        ['unlimited sentinel', effective({ [LimitKeyEnum.MAX_GASTRONOMIES]: 2147483647 })],
        ['zero', effective({ [LimitKeyEnum.MAX_GASTRONOMIES]: 0 })],
        ['negative', effective({ [LimitKeyEnum.MAX_GASTRONOMIES]: -1 })]
    ])('TEST:1757:3 omits a badge for %s capacity', (_case, effectiveSet) => {
        expect(
            buildListingUsage({ vertical: 'gastronomy', effectiveSet, listings: [] })
        ).toBeNull();
    });

    it('TEST:1757:4 fetches effective sets independently with the request cookie and contains failures', async () => {
        vi.mocked(effectiveSetApi.get).mockImplementation(async ({ vertical, cookieHeader }) => {
            expect(cookieHeader).toBe('sid=owner');
            if (vertical === 'experience') throw new Error('offline');
            return {
                ok: true,
                data: { entitlements: {}, limits: {}, hasLiveNonTrialTitle: true }
            } as never;
        });
        const result = await fetchListingEffectiveSets({
            verticals: ['gastronomy', 'experience'],
            cookieHeader: 'sid=owner'
        });
        expect(effectiveSetApi.get).toHaveBeenCalledTimes(2);
        expect(result.get('gastronomy')).toMatchObject({ failed: false });
        expect(result.get('experience')).toEqual({
            entitlements: {},
            limits: {},
            hasLiveNonTrialTitle: false,
            failed: true
        });
    });

    it('TEST:1757:4 marks a non-ok API result failed without blocking another vertical', async () => {
        vi.mocked(effectiveSetApi.get).mockImplementation(async ({ vertical }) =>
            vertical === 'gastronomy'
                ? ({ ok: false, error: { message: 'no' } } as never)
                : ({
                      ok: true,
                      data: { entitlements: {}, limits: {}, hasLiveNonTrialTitle: true }
                  } as never)
        );
        const result = await fetchListingEffectiveSets({ verticals: ['gastronomy', 'experience'] });
        expect(result.get('gastronomy')?.failed).toBe(true);
        expect(result.get('experience')?.failed).toBe(false);
    });

    it('TEST:1757:6 resolves the vertical pricing pages', () => {
        expect(resolveUsageUpgradePath({ vertical: 'gastronomy' })).toBe(
            'planes/gastronomia/precios'
        );
        expect(resolveUsageUpgradePath({ vertical: 'experience' })).toBe(
            'planes/experiencias/precios'
        );
    });

    it('TEST:1757:6 includes atLimit in all locale catalogs with matching usage keys', () => {
        const catalogs = ['es', 'en', 'pt'].map(
            (locale) =>
                JSON.parse(
                    readFileSync(
                        resolve(
                            __dirname,
                            `../../../../../packages/i18n/src/locales/${locale}/listing.json`
                        ),
                        'utf8'
                    )
                ).owner.list.usage
        );
        expect(catalogs.map(({ atLimit }) => atLimit)).toEqual([
            'Llegaste al tope de tu plan. Para publicar otra ficha, ampliá tu cupo.',
            'You have reached your plan limit. To publish another listing, add more capacity.',
            'Você atingiu o limite do seu plano. Para publicar outra ficha, amplie sua cota.'
        ]);
        expect(Object.keys(catalogs[0]).sort()).toEqual(Object.keys(catalogs[1]).sort());
        expect(Object.keys(catalogs[1]).sort()).toEqual(Object.keys(catalogs[2]).sort());
    });
});
