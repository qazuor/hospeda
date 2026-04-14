import { z } from 'zod';
import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import {
    UserAdminSchema,
    UserProtectedSchema,
    UserPublicSchema
} from '../user/user.access.schema.js';
import { SponsorshipLevelSchema } from './sponsorship-level.schema.js';
import { SponsorshipPackageSchema } from './sponsorship-package.schema.js';
import { SponsorshipSchema } from './sponsorship.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public display of sponsorship information (badges, banners, coupons).
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 * Excludes payment details, analytics, and internal references.
 *
 * Relation fields are optional to allow rich responses without stripping joined data.
 */
export const SponsorshipPublicSchema = SponsorshipSchema.pick({
    // Identification
    id: true,
    slug: true,

    // Target reference (what is being sponsored)
    targetType: true,
    targetId: true,

    // Status and validity
    status: true,
    startsAt: true,
    endsAt: true,

    // Public branding
    logoUrl: true,
    linkUrl: true,

    // Coupon (public)
    couponCode: true,
    couponDiscountPercent: true
}).extend({
    /** Resolved sponsor user (public fields only). */
    sponsorUser: UserPublicSchema.optional(),
    /** Resolved sponsorship level (base schema, no tier restriction). */
    level: SponsorshipLevelSchema.optional(),
    /** Resolved sponsorship package (base schema, no tier restriction). */
    package: SponsorshipPackageSchema.optional()
});

export type SponsorshipPublic = z.infer<typeof SponsorshipPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including sponsor identity and analytics.
 * Used for sponsor dashboards and authenticated sponsorship management.
 *
 * Extends public fields with ownership, package, and performance data.
 *
 * Relation fields are optional to allow rich responses without stripping joined data.
 */
export const SponsorshipProtectedSchema = SponsorshipSchema.pick({
    // All public fields
    id: true,
    slug: true,
    targetType: true,
    targetId: true,
    status: true,
    startsAt: true,
    endsAt: true,
    logoUrl: true,
    linkUrl: true,
    couponCode: true,
    couponDiscountPercent: true,

    // Sponsor identity
    sponsorUserId: true,

    // Package and level references
    levelId: true,
    packageId: true,

    // Payment reference
    paymentId: true,

    // Analytics (for sponsor dashboard)
    analytics: true,

    // Audit (for sponsors)
    createdAt: true,
    updatedAt: true
}).extend({
    /** Resolved sponsor user (protected fields). */
    sponsorUser: UserProtectedSchema.optional(),
    /** Resolved sponsorship level (base schema, no tier restriction). */
    level: SponsorshipLevelSchema.optional(),
    /** Resolved sponsorship package (base schema, no tier restriction). */
    package: SponsorshipPackageSchema.optional()
});

export type SponsorshipProtected = z.infer<typeof SponsorshipProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * Extends the full schema with resolved relations and the preemptive
 * `lifecycleState` field that will be promoted to the base schema in SPEC-063.
 *
 * Relation fields are optional to allow rich responses without stripping joined data.
 */
export const SponsorshipAdminSchema = SponsorshipSchema.extend({
    /** Resolved sponsor user (full admin fields). */
    sponsorUser: UserAdminSchema.optional(),
    /** Resolved sponsorship level (base schema, no tier restriction). */
    level: SponsorshipLevelSchema.optional(),
    /** Resolved sponsorship package (base schema, no tier restriction). */
    package: SponsorshipPackageSchema.optional(),
    /**
     * Preemptive SPEC-063 field: lifecycle state for workflow management.
     * Admin-only until the field is added to the base Sponsorship entity.
     */
    lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()
});

export type SponsorshipAdmin = z.infer<typeof SponsorshipAdminSchema>;
