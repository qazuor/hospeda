/**
 * HOS-2270: target and content rules of an owner promotion.
 *
 * The target pair has no foreign key, so these rules are the only integrity the
 * service gives it: the listing must exist, be the owner's, and a foreign one must
 * be indistinguishable from a missing one.
 */
import { moderateText } from '@repo/content-moderation';
import {
    OwnerPromotionDiscountTypeEnum,
    OwnerPromotionEntityTypeEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    assertCreateBenefit,
    assertDiscountTypeForEntity,
    moderatePromotionText,
    resolvePromotionTarget,
    validatePromotionUpdate
} from '../../../src/services/owner-promotion/ownerPromotion.target';
import { getMockId } from '../../factories/utilsFactory';

vi.mock('@repo/content-moderation', () => ({ moderateText: vi.fn() }));
vi.mock('../../../src/services/contentModeration/get-threshold-for-context', () => ({
    getThresholdForContext: vi.fn().mockResolvedValue({ pending: 0.5, reject: 0.9 })
}));

const OWNER = getMockId('user', 'owner');
const STRANGER = getMockId('user', 'stranger');
const LISTING = getMockId('accommodation', 'listing');
const moderate = vi.mocked(moderateText);

function models(row: { ownerId: string; deletedAt?: Date | null } | null) {
    return {
        accommodationModel: { findById: vi.fn().mockResolvedValue(row) },
        venueModel: { findById: vi.fn().mockResolvedValue(row) }
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    moderate.mockResolvedValue({ score: 0, degraded: false } as never);
});

describe('resolvePromotionTarget', () => {
    it('accepts a venue of the owner and writes no legacy column', async () => {
        const target = await resolvePromotionTarget({
            ownerId: OWNER,
            entityType: OwnerPromotionEntityTypeEnum.VENUE,
            entityId: LISTING,
            ...models({ ownerId: OWNER })
        });

        expect(target).toEqual({
            entityType: 'venue',
            entityId: LISTING,
            accommodationId: null
        });
    });

    it('answers NOT_FOUND for a venue of somebody else, same as a missing one', async () => {
        const foreign = resolvePromotionTarget({
            ownerId: OWNER,
            entityType: OwnerPromotionEntityTypeEnum.VENUE,
            entityId: LISTING,
            ...models({ ownerId: STRANGER })
        });
        const missing = resolvePromotionTarget({
            ownerId: OWNER,
            entityType: OwnerPromotionEntityTypeEnum.VENUE,
            entityId: LISTING,
            ...models(null)
        });

        await expect(foreign).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
        await expect(missing).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
        await expect(foreign).rejects.toThrow('ownerPromotion not found');
    });

    it('rejects a soft-deleted venue', async () => {
        await expect(
            resolvePromotionTarget({
                ownerId: OWNER,
                entityType: OwnerPromotionEntityTypeEnum.VENUE,
                entityId: LISTING,
                ...models({ ownerId: OWNER, deletedAt: new Date() })
            })
        ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
    });

    it('rejects a venue promotion without an entityId as a validation error', async () => {
        await expect(
            resolvePromotionTarget({
                ownerId: OWNER,
                entityType: OwnerPromotionEntityTypeEnum.VENUE,
                entityId: null,
                ...models({ ownerId: OWNER })
            })
        ).rejects.toMatchObject({ code: ServiceErrorCode.VALIDATION_ERROR });
    });

    it('AC-19: an accommodation write fills both columns with the same id, whichever came', async () => {
        const fromLegacy = await resolvePromotionTarget({
            ownerId: OWNER,
            accommodationId: LISTING,
            ...models({ ownerId: OWNER })
        });
        const fromEntity = await resolvePromotionTarget({
            ownerId: OWNER,
            entityId: LISTING,
            ...models({ ownerId: OWNER })
        });

        expect(fromLegacy).toEqual({
            entityType: 'accommodation',
            entityId: LISTING,
            accommodationId: LISTING
        });
        expect(fromEntity).toEqual(fromLegacy);
    });

    it('keeps the owner-wide accommodation promotion (no target) without reading anything', async () => {
        const deps = models({ ownerId: OWNER });

        const target = await resolvePromotionTarget({ ownerId: OWNER, ...deps });

        expect(target).toEqual({
            entityType: 'accommodation',
            entityId: null,
            accommodationId: null
        });
        expect(deps.accommodationModel.findById).not.toHaveBeenCalled();
    });

    it('rejects an accommodation that is not the owner (closes the old ownership hole)', async () => {
        await expect(
            resolvePromotionTarget({
                ownerId: OWNER,
                accommodationId: LISTING,
                ...models({ ownerId: STRANGER })
            })
        ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
    });

    it('rejects two different accommodation ids', async () => {
        await expect(
            resolvePromotionTarget({
                ownerId: OWNER,
                accommodationId: LISTING,
                entityId: getMockId('accommodation', 'other'),
                ...models({ ownerId: OWNER })
            })
        ).rejects.toMatchObject({ code: ServiceErrorCode.VALIDATION_ERROR });
    });
});

describe('assertDiscountTypeForEntity', () => {
    it('refuses special_offer on an accommodation and free_night on a venue', () => {
        expect(() =>
            assertDiscountTypeForEntity({
                entityType: OwnerPromotionEntityTypeEnum.ACCOMMODATION,
                discountType: OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER
            })
        ).toThrow('notForAccommodation');
        expect(() =>
            assertDiscountTypeForEntity({
                entityType: OwnerPromotionEntityTypeEnum.VENUE,
                discountType: OwnerPromotionDiscountTypeEnum.FREE_NIGHT
            })
        ).toThrow('notForVenue');
    });

    it('accepts each vertical its own types', () => {
        expect(() =>
            assertDiscountTypeForEntity({
                entityType: OwnerPromotionEntityTypeEnum.VENUE,
                discountType: OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER
            })
        ).not.toThrow();
        expect(() =>
            assertDiscountTypeForEntity({
                entityType: OwnerPromotionEntityTypeEnum.ACCOMMODATION,
                discountType: OwnerPromotionDiscountTypeEnum.FREE_NIGHT
            })
        ).not.toThrow();
    });
});

describe('moderatePromotionText (AC-20)', () => {
    it('lets a clean text through', async () => {
        await expect(moderatePromotionText({ text: '2x1 en tragos' })).resolves.toBeUndefined();
        expect(moderate).toHaveBeenCalledWith({ text: '2x1 en tragos', context: 'promotion' });
    });

    it('refuses a text at or above the pending threshold with a validation error', async () => {
        moderate.mockResolvedValue({ score: 1, degraded: false } as never);

        await expect(moderatePromotionText({ text: 'bad' })).rejects.toMatchObject({
            code: ServiceErrorCode.VALIDATION_ERROR
        });
    });

    it('fails closed when the engine could not judge', async () => {
        moderate.mockResolvedValue({ score: 0, degraded: true } as never);

        await expect(moderatePromotionText({ text: 'maybe fine' })).rejects.toMatchObject({
            code: ServiceErrorCode.VALIDATION_ERROR
        });
    });
});

describe('assertCreateBenefit', () => {
    it('requires a text for a special_offer and moderates it', async () => {
        await expect(
            assertCreateBenefit({
                entityType: OwnerPromotionEntityTypeEnum.VENUE,
                discountType: OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER,
                description: null
            })
        ).rejects.toThrow('specialOfferText.required');

        await assertCreateBenefit({
            entityType: OwnerPromotionEntityTypeEnum.VENUE,
            discountType: OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER,
            description: 'Postre gratis'
        });
        expect(moderate).toHaveBeenCalledTimes(1);
    });

    it('does not moderate a numeric benefit', async () => {
        await assertCreateBenefit({
            entityType: OwnerPromotionEntityTypeEnum.VENUE,
            discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
            description: 'whatever'
        });
        expect(moderate).not.toHaveBeenCalled();
    });
});

describe('validatePromotionUpdate', () => {
    const previous = {
        ownerId: OWNER,
        entityType: OwnerPromotionEntityTypeEnum.VENUE,
        discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
        description: null
    } as const;

    it('refuses minNights on a venue promotion', async () => {
        await expect(
            validatePromotionUpdate({
                previous,
                data: { minNights: 2 },
                ...models({ ownerId: OWNER })
            })
        ).rejects.toThrow('minNights.notForVenue');
    });

    it('moderates a special_offer text whenever it changes', async () => {
        await validatePromotionUpdate({
            previous: { ...previous, discountType: OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER },
            data: { description: 'Nuevo combo' },
            ...models({ ownerId: OWNER })
        });

        expect(moderate).toHaveBeenCalledWith({ text: 'Nuevo combo', context: 'promotion' });
    });

    it('does not moderate an untouched special_offer (a pause, a title edit)', async () => {
        await validatePromotionUpdate({
            previous: {
                ...previous,
                discountType: OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER,
                description: 'Combo'
            },
            data: {},
            ...models({ ownerId: OWNER })
        });

        expect(moderate).not.toHaveBeenCalled();
    });

    it('AC-19: re-targeting an accommodation promotion keeps both columns equal', async () => {
        const extra = await validatePromotionUpdate({
            previous: {
                ...previous,
                entityType: OwnerPromotionEntityTypeEnum.ACCOMMODATION
            },
            data: { accommodationId: LISTING },
            ...models({ ownerId: OWNER })
        });

        expect(extra).toEqual({ entityId: LISTING, accommodationId: LISTING });
    });
});
