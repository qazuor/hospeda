import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    AccommodationIdSchema,
    OwnerPromotionIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import {
    ACCOMMODATION_PROMOTION_DISCOUNT_TYPES,
    type OwnerPromotionDiscountTypeEnum,
    VENUE_PROMOTION_DISCOUNT_TYPES
} from '../../enums/owner-promotion-discount-type.enum.js';
import { OwnerPromotionDiscountTypeEnumSchema } from '../../enums/owner-promotion-discount-type.schema.js';
import { OwnerPromotionEntityTypeEnum } from '../../enums/owner-promotion-entity-type.enum.js';
import { OwnerPromotionEntityTypeEnumSchema } from '../../enums/owner-promotion-entity-type.schema.js';
import { TouristAudienceEnum } from '../../enums/tourist-audience.enum.js';
import { TouristAudienceEnumSchema } from '../../enums/tourist-audience.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';

/**
 * Refinement shared by every schema that carries the promotion target (HOS-2270).
 *
 * A promotion hangs from a listing through `entityType` + `entityId`. The pair is
 * consistent only when:
 * - a `venue` promotion has an `entityId` (there is no "all venues" promotion);
 * - an `accommodation` promotion never uses the venue-only `special_offer`;
 * - a `venue` promotion never uses `free_night` nor `minNights`.
 *
 * Postgres enforces the first rule with a CHECK; checking it here turns a would-be
 * 23514 (HTTP 500) into a 400 `VALIDATION_ERROR`.
 *
 * Applied with `.superRefine()` at the LEAF schemas only. Zod 4 refuses `.omit()`
 * and `.pick()` on a refined object, so the schemas the access tiers derive from
 * stay plain ({@link OwnerPromotionObjectSchema}).
 */
export const refineOwnerPromotionTarget = (
    value: {
        entityType?: OwnerPromotionEntityTypeEnum | undefined;
        entityId?: string | null | undefined;
        discountType?: OwnerPromotionDiscountTypeEnum | undefined;
        minNights?: number | null | undefined;
    },
    ctx: z.RefinementCtx
): void => {
    const entityType = value.entityType ?? OwnerPromotionEntityTypeEnum.ACCOMMODATION;
    if (entityType === OwnerPromotionEntityTypeEnum.VENUE) {
        if (!value.entityId) {
            ctx.addIssue({
                code: 'custom',
                path: ['entityId'],
                message: 'zodError.ownerPromotion.entityId.requiredForVenue'
            });
        }
        if (
            value.discountType !== undefined &&
            !(VENUE_PROMOTION_DISCOUNT_TYPES as readonly string[]).includes(value.discountType)
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['discountType'],
                message: 'zodError.ownerPromotion.discountType.notForVenue'
            });
        }
        if (value.minNights !== undefined && value.minNights !== null) {
            ctx.addIssue({
                code: 'custom',
                path: ['minNights'],
                message: 'zodError.ownerPromotion.minNights.notForVenue'
            });
        }
        return;
    }
    if (
        value.discountType !== undefined &&
        !(ACCOMMODATION_PROMOTION_DISCOUNT_TYPES as readonly string[]).includes(value.discountType)
    ) {
        ctx.addIssue({
            code: 'custom',
            path: ['discountType'],
            message: 'zodError.ownerPromotion.discountType.notForAccommodation'
        });
    }
};

/**
 * Owner Promotion entity object schema (unrefined).
 *
 * Kept as a plain `ZodObject` so `.pick()`, `.omit()` and `.extend()` keep
 * working. {@link OwnerPromotionSchema} is the same shape plus the target
 * refinement.
 */
export const OwnerPromotionObjectSchema = z.object({
    id: OwnerPromotionIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,

    slug: z
        .string({
            message: 'zodError.ownerPromotion.slug.required'
        })
        .min(1, { message: 'zodError.ownerPromotion.slug.min' }),

    ownerId: UserIdSchema,
    /**
     * @deprecated HOS-2270 release N (expand): read `entityType` + `entityId`.
     * Kept in sync on every accommodation write so a rollback of the code to the
     * previous release keeps working; dropped in the release N+1 (contract).
     */
    accommodationId: AccommodationIdSchema.nullable().optional(),

    /** Kind of listing the promotion hangs from (HOS-2270). */
    entityType: OwnerPromotionEntityTypeEnumSchema.default(
        OwnerPromotionEntityTypeEnum.ACCOMMODATION
    ),
    /**
     * Id of the listing the promotion hangs from. No foreign key (the target is
     * polymorphic): the service validates it exists and is the owner's. Null with
     * `entityType = 'accommodation'` means "all of the owner's accommodations".
     */
    entityId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }).nullable().optional(),

    title: z
        .string({
            message: 'zodError.ownerPromotion.title.required'
        })
        .min(1, { message: 'zodError.ownerPromotion.title.min' })
        .max(200, { message: 'zodError.ownerPromotion.title.max' }),

    description: z
        .string()
        .max(1000, { message: 'zodError.ownerPromotion.description.max' })
        .optional()
        .nullable(),

    discountType: OwnerPromotionDiscountTypeEnumSchema,

    discountValue: z
        .number({
            message: 'zodError.ownerPromotion.discountValue.required'
        })
        .min(0, { message: 'zodError.ownerPromotion.discountValue.min' }),

    minNights: z
        .number()
        .int({ message: 'zodError.ownerPromotion.minNights.int' })
        .min(1, { message: 'zodError.ownerPromotion.minNights.min' })
        .nullable()
        .optional(),

    validFrom: z.coerce.date({
        message: 'zodError.ownerPromotion.validFrom.required'
    }),

    validUntil: z.coerce
        .date({
            message: 'zodError.ownerPromotion.validUntil.invalid'
        })
        .nullable()
        .optional(),

    maxRedemptions: z
        .number()
        .int({ message: 'zodError.ownerPromotion.maxRedemptions.int' })
        .min(1, { message: 'zodError.ownerPromotion.maxRedemptions.min' })
        .nullable()
        .optional(),

    currentRedemptions: z
        .number()
        .int({ message: 'zodError.ownerPromotion.currentRedemptions.int' })
        .min(0, { message: 'zodError.ownerPromotion.currentRedemptions.min' })
        .default(0),

    /**
     * Tourist-tier visibility gate (HOS-21 D1). Additive: 'vip' tourists see
     * 'plus' + 'vip' rows, 'plus' tourists see 'plus' only. Owner self-service
     * (HOS-21 D2) — set directly through create/update, not server-managed.
     */
    touristAudience: TouristAudienceEnumSchema.default(TouristAudienceEnum.PLUS)
});

/**
 * Owner Promotion entity schema: the object plus the target refinement.
 */
export const OwnerPromotionSchema = OwnerPromotionObjectSchema.superRefine(
    refineOwnerPromotionTarget
);
export type OwnerPromotion = z.infer<typeof OwnerPromotionObjectSchema>;

/**
 * Create input for owner promotion, without the target refinement. Exists only
 * so the update and request schemas can derive from it; use
 * {@link OwnerPromotionCreateInputSchema} to validate.
 */
export const OwnerPromotionCreateInputBaseSchema = OwnerPromotionObjectSchema.omit({
    id: true,
    currentRedemptions: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
}).extend({
    slug: z
        .string({
            message: 'zodError.ownerPromotion.slug.required'
        })
        .min(1, { message: 'zodError.ownerPromotion.slug.min' })
        .optional(),
    // Absent means `accommodation` (the service fills it), so every pre-HOS-2270
    // caller of the create contract keeps compiling and working.
    entityType: OwnerPromotionEntityTypeEnumSchema.optional()
});

/**
 * Create input for owner promotion (service-level contract).
 */
export const OwnerPromotionCreateInputSchema = OwnerPromotionCreateInputBaseSchema.superRefine(
    refineOwnerPromotionTarget
);
export type OwnerPromotionCreateInput = z.infer<typeof OwnerPromotionCreateInputBaseSchema>;

/**
 * Update input for owner promotion.
 *
 * SPEC-063-gaps T-017 (GAP-016, AC-002-02): `.strict()` enforces that legacy keys
 * (e.g. `isActive`) are rejected at the route boundary with a 400 VALIDATION_ERROR
 * instead of being silently dropped by the Hono zValidator middleware.
 */
// Zod 4 .partial() keeps .default(); strip them so absent keys = no change (SPEC-217).
// The target (`entityType` / `entityId`) is fixed at creation and never changes: it
// is not part of the update contract, so a body carrying it is a 400.
export const OwnerPromotionUpdateInputSchema = z
    .object(
        stripShapeDefaults(
            OwnerPromotionCreateInputBaseSchema.omit({ entityType: true, entityId: true }).shape
        )
    )
    .partial()
    .strict();
export type OwnerPromotionUpdateInput = z.infer<typeof OwnerPromotionUpdateInputSchema>;

/**
 * Client-facing create request schema for owner promotions.
 *
 * Omits `ownerId` so the client cannot supply or forge it.
 * The route handler injects `ownerId` from the authenticated session actor.
 * This is the schema used as `requestBody` on POST /api/v1/protected/owner-promotions.
 */
export const OwnerPromotionCreateRequestSchema = OwnerPromotionCreateInputBaseSchema.omit({
    ownerId: true,
    // The accommodation route fixes the target (HOS-2270): the type is its own and
    // the id keeps travelling as `accommodationId` in the public contract.
    entityType: true,
    entityId: true
}).superRefine((value, ctx) => {
    if (
        value.discountType !== undefined &&
        !(ACCOMMODATION_PROMOTION_DISCOUNT_TYPES as readonly string[]).includes(value.discountType)
    ) {
        ctx.addIssue({
            code: 'custom',
            path: ['discountType'],
            message: 'zodError.ownerPromotion.discountType.notForAccommodation'
        });
    }
});
export type OwnerPromotionCreateRequest = z.infer<typeof OwnerPromotionCreateRequestSchema>;

/**
 * Search input for owner promotions
 */
export const OwnerPromotionSearchSchema = z.object({
    ownerId: UserIdSchema.optional(),
    accommodationId: AccommodationIdSchema.optional(),
    discountType: OwnerPromotionDiscountTypeEnumSchema.optional(),
    lifecycleState: LifecycleStatusEnumSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    // SPEC-063-gaps T-031 (GAP-041): `limit` → `pageSize` (monorepo convention).
    pageSize: z.coerce.number().int().min(1).max(100).default(20)
});
export type OwnerPromotionSearchInput = z.infer<typeof OwnerPromotionSearchSchema>;
