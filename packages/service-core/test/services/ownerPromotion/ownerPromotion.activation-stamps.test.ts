/**
 * HOS-2589: the server-managed stamps of an owner promotion.
 *
 * `firstActivatedAt` is written once, the first time a promotion is live (§7.7,
 * AC-19), and `vipPausedAt` is cleared when a paused «Solo VIP» promotion is
 * resumed or turned into «Para todos» (D-8, AC-37). The venue door now accepts
 * the audience the owner chose (D-4).
 */
import {
    LifecycleStatusEnum,
    OwnerPromotionDiscountTypeEnum,
    TouristAudienceEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    isVipResumption,
    resolveActivationStamps
} from '../../../src/services/owner-promotion/ownerPromotion.helpers';
import { buildVenueCreateInput } from '../../../src/services/owner-promotion/ownerPromotion.venue';

const NOW = new Date('2026-11-24T12:00:00.000Z');
const EARLIER = new Date('2026-10-01T00:00:00.000Z');

describe('resolveActivationStamps', () => {
    it('stamps the first activation of a draft that goes live', () => {
        expect(
            resolveActivationStamps({
                previous: { lifecycleState: LifecycleStatusEnum.DRAFT, firstActivatedAt: null },
                data: { lifecycleState: LifecycleStatusEnum.ACTIVE },
                now: NOW
            })
        ).toEqual({ firstActivatedAt: NOW });
    });

    it('AC-19: an edit of a live promotion never moves its first activation', () => {
        expect(
            resolveActivationStamps({
                previous: { lifecycleState: LifecycleStatusEnum.ACTIVE, firstActivatedAt: EARLIER },
                data: {},
                now: NOW
            })
        ).toEqual({});
        expect(
            resolveActivationStamps({
                previous: {
                    lifecycleState: LifecycleStatusEnum.INACTIVE,
                    firstActivatedAt: EARLIER
                },
                data: { lifecycleState: LifecycleStatusEnum.ACTIVE },
                now: NOW
            })
        ).toEqual({});
    });

    it('does not stamp a promotion that stays out of ACTIVE', () => {
        expect(
            resolveActivationStamps({
                previous: { lifecycleState: LifecycleStatusEnum.DRAFT, firstActivatedAt: null },
                data: { lifecycleState: LifecycleStatusEnum.ARCHIVED },
                now: NOW
            })
        ).toEqual({});
    });

    it('AC-37: resuming a paused «Solo VIP» promotion clears its pause stamp', () => {
        const previous = {
            lifecycleState: LifecycleStatusEnum.INACTIVE,
            touristAudience: TouristAudienceEnum.VIP,
            firstActivatedAt: EARLIER,
            vipPausedAt: EARLIER
        };
        expect(
            resolveActivationStamps({
                previous,
                data: {
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    touristAudience: TouristAudienceEnum.PLUS
                },
                now: NOW
            })
        ).toEqual({ vipPausedAt: null });
        expect(
            resolveActivationStamps({
                previous,
                data: { touristAudience: TouristAudienceEnum.PLUS },
                now: NOW
            })
        ).toEqual({ vipPausedAt: null });
        expect(
            resolveActivationStamps({ previous, data: { title: 'x' } as never, now: NOW })
        ).toEqual({});
    });
});

describe('VIP pause is never lifted by a bare re-activation (security review, D-8)', () => {
    const paused = {
        lifecycleState: LifecycleStatusEnum.INACTIVE,
        touristAudience: TouristAudienceEnum.VIP,
        firstActivatedAt: EARLIER,
        vipPausedAt: EARLIER
    };

    it('re-activating as «Solo VIP» without a verified key keeps the pause stamp', () => {
        expect(
            resolveActivationStamps({
                previous: paused,
                data: { lifecycleState: LifecycleStatusEnum.ACTIVE },
                now: NOW
            })
        ).toEqual({});
    });

    it('re-activating as «Solo VIP» with a verified key clears it', () => {
        expect(
            resolveActivationStamps({
                previous: paused,
                data: { lifecycleState: LifecycleStatusEnum.ACTIVE },
                now: NOW,
                vipOnlyVerified: true
            })
        ).toEqual({ vipPausedAt: null });
    });

    it('isVipResumption flags exactly a paused vip promotion going live as vip', () => {
        expect(
            isVipResumption({
                previous: paused,
                data: { lifecycleState: LifecycleStatusEnum.ACTIVE }
            })
        ).toBe(true);
        expect(
            isVipResumption({
                previous: paused,
                data: {
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    touristAudience: TouristAudienceEnum.PLUS
                }
            })
        ).toBe(false);
        expect(isVipResumption({ previous: paused, data: { title: 'x' } as never })).toBe(false);
        expect(
            isVipResumption({
                previous: { ...paused, vipPausedAt: null },
                data: { lifecycleState: LifecycleStatusEnum.ACTIVE }
            })
        ).toBe(false);
    });
});

describe('buildVenueCreateInput audience (D-4)', () => {
    const venue = {
        id: '11111111-1111-4111-8111-111111111111',
        ownerId: '22222222-2222-4222-8222-222222222222'
    };
    const request = {
        title: 'Happy hour',
        discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
        discountValue: 20,
        validFrom: NOW
    };

    it('keeps «Solo VIP» when the owner chose it', () => {
        const input = buildVenueCreateInput({
            venue: venue as never,
            request: { ...request, touristAudience: TouristAudienceEnum.VIP } as never
        });
        expect(input.touristAudience).toBe(TouristAudienceEnum.VIP);
    });

    it('defaults to «Para todos»', () => {
        const input = buildVenueCreateInput({ venue: venue as never, request: request as never });
        expect(input.touristAudience).toBe(TouristAudienceEnum.PLUS);
    });
});
