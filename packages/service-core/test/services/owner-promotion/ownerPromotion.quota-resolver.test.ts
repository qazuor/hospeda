/**
 * HOS-2589 §7.3: the seeded resolver of the free / VIP promotions model
 * (AC-5, AC-6, AC-7, AC-12, AC-13) and the placeholder name (AC-8, AC-29).
 */
import { TouristAudienceEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildPlaceholderName,
    createSeededRandom,
    hashSeed,
    resolvePromotionVisibility
} from '../../../src/services/owner-promotion/ownerPromotion.quota-resolver';

/** The quota as a fixture value, standing for the catalog row (never a src literal). */
const FREE_QUOTA = 3;

function promo(id: string, audience: TouristAudienceEnum) {
    return { id, touristAudience: audience };
}

/** «Page P»: 5 `plus` and 2 `vip` active promotions. */
const PAGE_P = [
    promo('p1', TouristAudienceEnum.PLUS),
    promo('v1', TouristAudienceEnum.VIP),
    promo('p2', TouristAudienceEnum.PLUS),
    promo('p3', TouristAudienceEnum.PLUS),
    promo('v2', TouristAudienceEnum.VIP),
    promo('p4', TouristAudienceEnum.PLUS),
    promo('p5', TouristAudienceEnum.PLUS)
];

const visibleIds = (decisions: ReturnType<typeof resolvePromotionVisibility>) =>
    decisions.filter((d) => d.kind === 'visible').map((d) => d.promotion.id);

describe('resolvePromotionVisibility', () => {
    it('AC-5: a free reader sees exactly the quota, all plus, and the rest locked', () => {
        // Act
        const decisions = resolvePromotionVisibility({
            promotions: PAGE_P,
            isVip: false,
            freeQuota: FREE_QUOTA,
            seed: 'seed-aaaa'
        });

        // Assert
        const visible = decisions.filter((d) => d.kind === 'visible');
        const locked = decisions.filter((d) => d.kind === 'locked');
        expect(visible).toHaveLength(FREE_QUOTA);
        expect(visible.every((d) => d.promotion.touristAudience === 'plus')).toBe(true);
        expect(locked).toHaveLength(4);
        expect(locked.filter((d) => d.promotion.touristAudience === 'vip')).toHaveLength(2);
    });

    it('orders visible first, then locked plus, then locked vip', () => {
        const decisions = resolvePromotionVisibility({
            promotions: PAGE_P,
            isVip: false,
            freeQuota: FREE_QUOTA,
            seed: 'seed-order'
        });
        expect(decisions.map((d) => `${d.kind}:${d.promotion.touristAudience}`)).toEqual([
            'visible:plus',
            'visible:plus',
            'visible:plus',
            'locked:plus',
            'locked:plus',
            'locked:vip',
            'locked:vip'
        ]);
    });

    it('AC-6: the same seed over the same set gives the same pick, in any input order', () => {
        const first = resolvePromotionVisibility({
            promotions: PAGE_P,
            isVip: false,
            freeQuota: FREE_QUOTA,
            seed: 'stable-seed'
        });
        const second = resolvePromotionVisibility({
            promotions: [...PAGE_P].reverse(),
            isVip: false,
            freeQuota: FREE_QUOTA,
            seed: 'stable-seed'
        });
        expect(new Set(visibleIds(second))).toEqual(new Set(visibleIds(first)));
    });

    it('AC-6: different seeds over the same five plus give different picks, each a plus subset', () => {
        const plusIds = new Set(['p1', 'p2', 'p3', 'p4', 'p5']);
        const picks = new Set<string>();
        for (let n = 0; n < 20; n += 1) {
            const ids = visibleIds(
                resolvePromotionVisibility({
                    promotions: PAGE_P,
                    isVip: false,
                    freeQuota: FREE_QUOTA,
                    seed: `seed-${n}`
                })
            );
            for (const id of ids) expect(plusIds.has(id)).toBe(true);
            picks.add([...ids].sort().join(','));
        }
        expect(picks.size).toBeGreaterThan(1);
    });

    it('AC-7: with X or fewer plus, all of them are visible and only vip is locked', () => {
        const decisions = resolvePromotionVisibility({
            promotions: [
                promo('p1', TouristAudienceEnum.PLUS),
                promo('p2', TouristAudienceEnum.PLUS),
                promo('v1', TouristAudienceEnum.VIP)
            ],
            isVip: false,
            freeQuota: FREE_QUOTA,
            seed: 'any-seed'
        });
        expect(visibleIds(decisions).sort()).toEqual(['p1', 'p2']);
        expect(decisions.filter((d) => d.kind === 'locked').map((d) => d.promotion.id)).toEqual([
            'v1'
        ]);
    });

    it('AC-11: a quota of 0 (failed or missing catalog read) locks everything', () => {
        const decisions = resolvePromotionVisibility({
            promotions: PAGE_P,
            isVip: false,
            freeQuota: 0,
            seed: 'x-seed'
        });
        expect(decisions.every((d) => d.kind === 'locked')).toBe(true);
    });

    it('treats a non-finite or negative quota as 0', () => {
        for (const freeQuota of [Number.NaN, -2]) {
            const decisions = resolvePromotionVisibility({
                promotions: PAGE_P,
                isVip: false,
                freeQuota,
                seed: 'x-seed'
            });
            expect(decisions.every((d) => d.kind === 'locked')).toBe(true);
        }
    });

    it('AC-12/AC-13: a VIP reader sees all seven, vip ones keeping their audience', () => {
        const decisions = resolvePromotionVisibility({
            promotions: PAGE_P,
            isVip: true,
            freeQuota: 0,
            seed: 'vip-seed'
        });
        expect(decisions).toHaveLength(7);
        expect(decisions.every((d) => d.kind === 'visible')).toBe(true);
        expect(decisions.filter((d) => d.promotion.touristAudience === 'vip')).toHaveLength(2);
    });
});

describe('buildPlaceholderName (D-5)', () => {
    it('AC-29: has the real length, differs from it and is stable per seed and index', () => {
        const realName = 'Cabañas del Río';
        const a = buildPlaceholderName({ realName, seed: 's1', index: 0 });
        const b = buildPlaceholderName({ realName, seed: 's1', index: 0 });

        expect(a).toHaveLength(realName.length);
        expect(a).not.toBe(realName);
        expect(a).toBe(b);
        expect(a).toMatch(/^[a-z ]+$/);
    });

    it('does not reuse the real name letters or word breaks', () => {
        const realName = 'Hotel Hotel Hotel Hotel';
        const placeholder = buildPlaceholderName({ realName, seed: 'seed', index: 3 });
        expect(placeholder.toLowerCase()).not.toContain('hotel');
    });

    it('differs per index within a response', () => {
        const name = 'Posada Las Moras';
        expect(buildPlaceholderName({ realName: name, seed: 's', index: 0 })).not.toBe(
            buildPlaceholderName({ realName: name, seed: 's', index: 1 })
        );
    });

    it('uses a fixed length when the place name is unknown', () => {
        expect(
            buildPlaceholderName({ realName: null, seed: 's', index: 0 }).length
        ).toBeGreaterThan(0);
    });
});

describe('seeded PRNG', () => {
    it('is reproducible and in [0, 1)', () => {
        const one = createSeededRandom({ seed: hashSeed({ value: 'abc' }) });
        const two = createSeededRandom({ seed: hashSeed({ value: 'abc' }) });
        for (let n = 0; n < 50; n += 1) {
            const value = one();
            expect(value).toBe(two());
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });
});
