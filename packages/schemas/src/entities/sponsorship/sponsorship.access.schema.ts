import type { z } from 'zod';
import { SponsorshipSchema } from './sponsorship.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public display of sponsorship information (badges, banners, coupons).
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 * Excludes payment details, analytics, and internal references.
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
});

export type SponsorshipPublic = z.infer<typeof SponsorshipPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including sponsor identity and analytics.
 * Used for sponsor dashboards and authenticated sponsorship management.
 *
 * Extends public fields with ownership, package, and performance data.
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
});

export type SponsorshipProtected = z.infer<typeof SponsorshipProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const SponsorshipAdminSchema = SponsorshipSchema;

export type SponsorshipAdmin = z.infer<typeof SponsorshipAdminSchema>;
