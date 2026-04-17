import type { z } from 'zod';
import {
    AccommodationAdminSchema,
    AccommodationProtectedSchema,
    AccommodationPublicSchema
} from '../accommodation/accommodation.access.schema.js';
import {
    UserAdminSchema,
    UserProtectedSchema,
    UserPublicSchema
} from '../user/user.access.schema.js';
import { OwnerPromotionSchema } from './owner-promotion.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public promotion listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 * Excludes ownership details and redemption tracking.
 */
export const OwnerPromotionPublicSchema = OwnerPromotionSchema.pick({
    // Identification
    id: true,
    slug: true,

    // Relation (which accommodation)
    accommodationId: true,

    // Promotion content
    title: true,
    description: true,

    // Discount details (public)
    discountType: true,
    discountValue: true,
    minNights: true,

    // Validity period (public)
    validFrom: true,
    validUntil: true
}).extend({
    /** Resolved owner data (public tier). Available when the API joins the user. */
    owner: UserPublicSchema.optional(),
    /** Resolved accommodation data (public tier). Available when the API joins the record. */
    accommodation: AccommodationPublicSchema.optional()
});

export type OwnerPromotionPublic = z.infer<typeof OwnerPromotionPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including ownership and redemption tracking.
 * Used for owner dashboards and authenticated promotion management.
 *
 * Extends public fields with ownership and operational data.
 */
export const OwnerPromotionProtectedSchema = OwnerPromotionSchema.pick({
    // All public fields
    id: true,
    slug: true,
    accommodationId: true,
    title: true,
    description: true,
    discountType: true,
    discountValue: true,
    minNights: true,
    validFrom: true,
    validUntil: true,

    // Ownership
    ownerId: true,

    // Redemption tracking
    maxRedemptions: true,
    currentRedemptions: true,

    // Audit (for owners)
    createdAt: true,
    updatedAt: true
}).extend({
    /** Resolved owner data (protected tier). Available when the API joins the user. */
    owner: UserProtectedSchema.optional(),
    /** Resolved accommodation data (protected tier). Available when the API joins the record. */
    accommodation: AccommodationProtectedSchema.optional()
});

export type OwnerPromotionProtected = z.infer<typeof OwnerPromotionProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * Extends the full schema with relation objects (admin tier). The `lifecycleState`
 * field is already included via the base schema's `BaseLifecycleFields` spread.
 */
export const OwnerPromotionAdminSchema = OwnerPromotionSchema.extend({
    /** Resolved owner data (admin tier). Available when the API joins the user. */
    owner: UserAdminSchema.optional(),
    /** Resolved accommodation data (admin tier). Available when the API joins the record. */
    accommodation: AccommodationAdminSchema.optional()
});

export type OwnerPromotionAdmin = z.infer<typeof OwnerPromotionAdminSchema>;
