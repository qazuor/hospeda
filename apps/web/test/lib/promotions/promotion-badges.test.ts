/**
 * HOS-2589 D-6 (AC-33, AC-34): search-card promotion badges.
 */
import { describe, expect, it } from 'vitest';
import { toAccommodationCardProps } from '../../../src/lib/api/transforms';
import {
    resolvePromotionBadges,
    resolveVenuePromoBadges
} from '../../../src/lib/promotions/promotion-badges';

describe('resolvePromotionBadges', () => {
    it('AC-33: shows both badges when the place has both kinds', () => {
        expect(resolvePromotionBadges({ hasFreePromotion: true, hasVipPromotion: true })).toEqual({
            free: true,
            vip: true
        });
    });

    it('AC-34: only «VIP» for a place whose promotions are all «Solo VIP»', () => {
        expect(resolvePromotionBadges({ hasFreePromotion: false, hasVipPromotion: true })).toEqual({
            free: false,
            vip: true
        });
    });

    it('ignores non-boolean values', () => {
        expect(resolvePromotionBadges({ hasFreePromotion: 'yes' })).toEqual({
            free: false,
            vip: false
        });
    });
});

describe('resolveVenuePromoBadges', () => {
    const base = { hasPromo: true as const, hasUnscheduled: true, windows: [] };

    it('reads the two flags', () => {
        expect(
            resolveVenuePromoBadges({
                badge: { ...base, vipOnly: false, hasFreePromotion: true, hasVipPromotion: true }
            })
        ).toMatchObject({ free: true, vip: true });
    });

    it('falls back to vipOnly for an older payload', () => {
        expect(resolveVenuePromoBadges({ badge: { ...base, vipOnly: true } })).toMatchObject({
            free: false,
            vip: true
        });
    });

    it('no badge without a promoBadge', () => {
        expect(resolveVenuePromoBadges({})).toEqual({ free: false, vip: false, windows: [] });
    });
});

describe('toAccommodationCardProps', () => {
    it('carries the presence flags only when true', () => {
        const card = toAccommodationCardProps({
            item: { id: 'a', slug: 's', name: 'N', hasFreePromotion: false, hasVipPromotion: true }
        });
        expect(card.hasVipPromotion).toBe(true);
        expect(card).not.toHaveProperty('hasFreePromotion');
    });
});
