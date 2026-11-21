/**
 * Venue promotion schemas (HOS-2270).
 *
 * A venue owner creates and edits promotions through the routes that hang from
 * the venue (`/protected/venues/{id}/promotions`). These schemas are NOT the
 * accommodation ones: a venue promotion has no `minNights`, no redemption cap, no
 * `accommodationId`, and one extra benefit type, `special_offer` (free text).
 *
 * The owner, the target type and the target id never come from the body: the
 * route fixes them from the session and the `{id}` path parameter.
 */
import { z } from 'zod';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import { OwnerPromotionDiscountTypeEnum } from '../../enums/owner-promotion-discount-type.enum.js';
import { TouristAudienceEnum } from '../../enums/tourist-audience.enum.js';
import { VenueEventTimeSchema } from '../venue/subtypes/venue.event.schema.js';
import { OwnerPromotionObjectSchema } from './owner-promotion.schema.js';

/** Weekly recurring time range for a venue promotion. Sunday is 0. */
export const PromotionWindowSchema = z.object({
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    startTime: VenueEventTimeSchema,
    endTime: VenueEventTimeSchema
});
export type PromotionWindow = z.infer<typeof PromotionWindowSchema>;

/** Maps the additive database columns to the public window object. */
export function toPromotionWindow(value: {
    readonly windowWeekdays?: readonly number[] | null;
    readonly windowStart?: string | null;
    readonly windowEnd?: string | null;
}): PromotionWindow | null {
    if (value.windowWeekdays == null || value.windowStart == null || value.windowEnd == null)
        return null;
    return {
        weekdays: [...value.windowWeekdays],
        startTime: value.windowStart.slice(0, 5),
        endTime: value.windowEnd.slice(0, 5)
    };
}

/** Maps a public window object to nullable database columns. */
export function fromPromotionWindow(window: PromotionWindow | null | undefined): {
    readonly windowWeekdays: number[] | null;
    readonly windowStart: string | null;
    readonly windowEnd: string | null;
} {
    return window == null
        ? { windowWeekdays: null, windowStart: null, windowEnd: null }
        : {
              windowWeekdays: [...window.weekdays],
              windowStart: window.startTime,
              windowEnd: window.endTime
          };
}

/** Adds window completeness and non-ambiguous interval validation. */
const refinePromotionWindow = (
    value: { window?: PromotionWindow | null },
    ctx: z.RefinementCtx
): void => {
    const window = value.window;
    if (window && new Set(window.weekdays).size !== window.weekdays.length) {
        ctx.addIssue({
            code: 'custom',
            path: ['window', 'weekdays'],
            message: 'zodError.ownerPromotion.window.duplicateWeekday'
        });
    }
    if (window && window.startTime === window.endTime) {
        ctx.addIssue({
            code: 'custom',
            path: ['window', 'endTime'],
            message: 'zodError.ownerPromotion.window.sameTime'
        });
    }
};

/** Upper bound of a `special_offer` text; it is stored in `description` (max 1000). */
export const VENUE_SPECIAL_OFFER_TEXT_MAX_LENGTH = 1000;

/** The venue benefit types that carry a numeric `discountValue`. */
const VALUE_DISCOUNT_TYPES = [
    OwnerPromotionDiscountTypeEnum.PERCENTAGE,
    OwnerPromotionDiscountTypeEnum.FIXED
] as const;

/** Fields shared by the create and update bodies of a venue promotion. */
const venuePromotionFields = {
    title: z
        .string({ message: 'zodError.ownerPromotion.title.required' })
        .trim()
        .min(1, { message: 'zodError.ownerPromotion.title.min' })
        .max(200, { message: 'zodError.ownerPromotion.title.max' }),
    description: z
        .string()
        .max(1000, { message: 'zodError.ownerPromotion.description.max' })
        .nullable()
        .optional(),
    discountType: z.enum(
        [
            OwnerPromotionDiscountTypeEnum.PERCENTAGE,
            OwnerPromotionDiscountTypeEnum.FIXED,
            OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER
        ],
        { error: () => ({ message: 'zodError.ownerPromotion.discountType.notForVenue' }) }
    ),
    discountValue: z
        .number({ message: 'zodError.ownerPromotion.discountValue.required' })
        .int({ message: 'zodError.ownerPromotion.discountValue.int' })
        .min(0, { message: 'zodError.ownerPromotion.discountValue.min' })
        .optional(),
    /** Free text of a `special_offer`. Stored in `description`; moderated by the service. */
    specialOfferText: z
        .string()
        .trim()
        .min(1, { message: 'zodError.ownerPromotion.specialOfferText.min' })
        .max(VENUE_SPECIAL_OFFER_TEXT_MAX_LENGTH, {
            message: 'zodError.ownerPromotion.specialOfferText.max'
        })
        .optional(),
    validFrom: z.coerce.date({ message: 'zodError.ownerPromotion.validFrom.required' }),
    validUntil: z.coerce
        .date({ message: 'zodError.ownerPromotion.validUntil.invalid' })
        .nullable()
        .optional(),
    /** Only `plus` is accepted here; `vip` enters with the VIP-promotions leaf (HOS-2273). */
    touristAudience: z
        .literal(TouristAudienceEnum.PLUS, {
            error: () => ({ message: 'zodError.ownerPromotion.touristAudience.venuePlusOnly' })
        })
        .default(TouristAudienceEnum.PLUS),
    window: PromotionWindowSchema.nullable().optional()
};

/** Validates the benefit of a venue promotion body (types, value and free text). */
const refineVenueBenefit = (
    value: {
        discountType?: OwnerPromotionDiscountTypeEnum | undefined;
        discountValue?: number | undefined;
        specialOfferText?: string | undefined;
        description?: string | null | undefined;
        validFrom?: Date | undefined;
        validUntil?: Date | null | undefined;
    },
    ctx: z.RefinementCtx
): void => {
    if (value.discountType === OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER) {
        if (value.specialOfferText === undefined) {
            ctx.addIssue({
                code: 'custom',
                path: ['specialOfferText'],
                message: 'zodError.ownerPromotion.specialOfferText.required'
            });
        }
        if (value.description !== undefined && value.description !== null) {
            ctx.addIssue({
                code: 'custom',
                path: ['description'],
                message: 'zodError.ownerPromotion.specialOfferText.noDescription'
            });
        }
        if (value.discountValue !== undefined && value.discountValue !== 0) {
            ctx.addIssue({
                code: 'custom',
                path: ['discountValue'],
                message: 'zodError.ownerPromotion.discountValue.notForSpecialOffer'
            });
        }
    } else if (value.discountType !== undefined) {
        if (value.specialOfferText !== undefined) {
            ctx.addIssue({
                code: 'custom',
                path: ['specialOfferText'],
                message: 'zodError.ownerPromotion.specialOfferText.onlyForSpecialOffer'
            });
        }
        if (
            (VALUE_DISCOUNT_TYPES as readonly string[]).includes(value.discountType) &&
            (value.discountValue === undefined || value.discountValue < 1)
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['discountValue'],
                message: 'zodError.ownerPromotion.discountValue.min'
            });
        }
        if (
            value.discountType === OwnerPromotionDiscountTypeEnum.PERCENTAGE &&
            value.discountValue !== undefined &&
            value.discountValue > 100
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['discountValue'],
                message: 'zodError.ownerPromotion.discountValue.maxPercentage'
            });
        }
    }
    if (
        value.validFrom instanceof Date &&
        value.validUntil instanceof Date &&
        value.validUntil.getTime() <= value.validFrom.getTime()
    ) {
        ctx.addIssue({
            code: 'custom',
            path: ['validUntil'],
            message: 'zodError.ownerPromotion.validUntil.beforeValidFrom'
        });
    }
};

/**
 * Create body of a venue promotion (`POST /protected/venues/{id}/promotions`).
 *
 * `.strict()`: `minNights`, `accommodationId`, `maxRedemptions`, `ownerId`,
 * `entityType` and `entityId` in the body are a 400, never silently dropped.
 */
export const VenuePromotionCreateRequestSchema = z
    .object(venuePromotionFields)
    .strict()
    .superRefine((value, ctx) => {
        refineVenueBenefit(value, ctx);
        refinePromotionWindow(value, ctx);
    });
export type VenuePromotionCreateRequest = z.infer<typeof VenuePromotionCreateRequestSchema>;

const { touristAudience: _touristAudience, ...updatableFields } = venuePromotionFields;

/**
 * Update body of a venue promotion (PUT and PATCH). Partial and strict, like the
 * accommodation one, so `minNights` in the body is a 400. `lifecycleState` lets the
 * owner pause (`ARCHIVED` / `DRAFT`) or re-activate a promotion.
 */
export const VenuePromotionUpdateRequestSchema = z
    .object({
        ...updatableFields,
        // An absent key means "no change", so no default here.
        touristAudience: z
            .literal(TouristAudienceEnum.PLUS, {
                error: () => ({ message: 'zodError.ownerPromotion.touristAudience.venuePlusOnly' })
            })
            .optional(),
        lifecycleState: LifecycleStatusEnumSchema
    })
    .partial()
    .strict()
    .superRefine((value, ctx) => {
        refineVenueBenefit(value, ctx);
        refinePromotionWindow(value, ctx);
    });
export type VenuePromotionUpdateRequest = z.infer<typeof VenuePromotionUpdateRequestSchema>;

/** A venue promotion as the owner sees it. */
export const VenuePromotionProtectedSchema = OwnerPromotionObjectSchema.pick({
    id: true,
    slug: true,
    ownerId: true,
    entityType: true,
    entityId: true,
    title: true,
    description: true,
    discountType: true,
    discountValue: true,
    lifecycleState: true,
    touristAudience: true,
    validFrom: true,
    validUntil: true,
    createdAt: true,
    updatedAt: true
}).extend({ window: PromotionWindowSchema.nullable() });
export type VenuePromotionProtected = z.infer<typeof VenuePromotionProtectedSchema>;

/** Narrow public shape for currently visible PLUS promotions on a venue detail. */
export const VenuePromotionPublicSchema = OwnerPromotionObjectSchema.pick({
    id: true,
    title: true,
    description: true,
    discountType: true,
    discountValue: true,
    validFrom: true,
    validUntil: true
}).extend({ window: PromotionWindowSchema.nullable() });
export type VenuePromotionPublic = z.infer<typeof VenuePromotionPublicSchema>;

/** Public response for GET /public/venues/{id}/promotions. */
export const VenuePromotionPublicListSchema = z.object({
    items: z.array(VenuePromotionPublicSchema)
});

/**
 * Response of `GET /protected/venues/{id}/promotions`: the owner's promotions of
 * the venue plus the quota counters the editor needs. `maxActive` is
 * `2147483647` when the plan has no cap.
 */
export const VenuePromotionListOutputSchema = z.object({
    items: z.array(VenuePromotionProtectedSchema),
    meta: z.object({
        activeCount: z.number().int().min(0),
        maxActive: z.number().int().min(0)
    })
});
export type VenuePromotionListOutput = z.infer<typeof VenuePromotionListOutputSchema>;
