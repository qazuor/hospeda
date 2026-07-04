import { z } from 'zod';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';

/**
 * KPI counters returned by the social dashboard.
 */
export const SocialDashboardKpisSchema = z.object({
    /** Total non-deleted posts. */
    totalPosts: z.number().int().nonnegative(),
    /** Posts currently in NEEDS_REVIEW status with approval PENDING. */
    pendingReview: z.number().int().nonnegative(),
    /** Posts currently in SCHEDULED status. */
    scheduled: z.number().int().nonnegative(),
    /**
     * Posts published in the last 30 days.
     * Derived from social_publish_logs rows with SUCCESS status in the last 30 days
     * (de-duped by socialPostId to count unique posts, not individual log entries).
     */
    publishedLast30Days: z.number().int().nonnegative(),
    /** Posts currently in FAILED status. */
    failedActionNeeded: z.number().int().nonnegative()
});

export type SocialDashboardKpis = z.infer<typeof SocialDashboardKpisSchema>;

/**
 * Quick approval queue item for the social dashboard.
 */
export const SocialDashboardQueueItemSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    status: z.string(),
    /** Distinct platforms from the post's social_post_targets. */
    platforms: z.array(z.string()),
    /** Cloudinary URL of the first media asset (position 0), or null. */
    thumbnailUrl: z.string().nullable(),
    createdAt: z.coerce.date()
});

export type SocialDashboardQueueItem = z.infer<typeof SocialDashboardQueueItemSchema>;

/**
 * Recent failure item for the social dashboard.
 */
export const SocialDashboardFailureItemSchema = z.object({
    /** UUID of the social_post_targets row. */
    targetId: z.string().uuid(),
    /** Title of the parent social post. */
    postTitle: z.string(),
    /** Platform of the target. */
    platform: SocialPlatformEnumSchema.or(z.string()),
    /** Last error message from the target row. */
    lastError: z.string().nullable(),
    /** Retry count on the target row. */
    retryCount: z.number().int().nonnegative(),
    /** When the target was last updated (used as failedAt). */
    failedAt: z.coerce.date()
});

export type SocialDashboardFailureItem = z.infer<typeof SocialDashboardFailureItemSchema>;

/**
 * Per-platform target count for the social dashboard (HOS-66 T-006/T-007, G-7).
 */
export const SocialDashboardPlatformBreakdownItemSchema = z.object({
    platform: SocialPlatformEnumSchema.or(z.string()),
    count: z.number().int().nonnegative()
});

export type SocialDashboardPlatformBreakdownItem = z.infer<
    typeof SocialDashboardPlatformBreakdownItemSchema
>;

/**
 * Full response shape for GET /api/v1/admin/social/dashboard.
 */
export const SocialDashboardResponseSchema = z.object({
    /** Aggregate KPI counters. */
    kpis: SocialDashboardKpisSchema,
    /**
     * Up to 10 posts in NEEDS_REVIEW / PENDING waiting for admin approval,
     * sorted by createdAt ASC (oldest first).
     */
    quickApprovalQueue: z.array(SocialDashboardQueueItemSchema),
    /**
     * Up to 10 most recent failed publish targets (newest first).
     * Sourced from social_post_targets with FAILED status.
     */
    recentFailures: z.array(SocialDashboardFailureItemSchema),
    /**
     * Whether a Make webhook URL is configured in the social credential vault.
     * True when the `make_webhook_url` vault credential resolves to a
     * non-empty plaintext value (HOS-64 — getDashboard vault migration).
     */
    makeWebhookConfigured: z.boolean(),
    /**
     * Target count per platform, scoped to the same optional date range as
     * the KPIs (HOS-66 T-006/T-007, G-7). Always populated by the service —
     * not optional.
     */
    platformBreakdown: z.array(SocialDashboardPlatformBreakdownItemSchema)
});

export type SocialDashboardResponse = z.infer<typeof SocialDashboardResponseSchema>;

/**
 * Query params for GET /api/v1/admin/social/dashboard (HOS-66 T-007, G-7).
 * Both bounds optional — omitting both preserves the pre-existing unfiltered
 * (all-time) behavior.
 */
export const SocialDashboardQuerySchema = z.object({
    /** Lower bound (inclusive) for the KPI/queue/failures/breakdown queries. */
    dateFrom: z.coerce.date().optional(),
    /** Upper bound (inclusive) for the KPI/queue/failures/breakdown queries. */
    dateTo: z.coerce.date().optional()
});

export type SocialDashboardQuery = z.infer<typeof SocialDashboardQuerySchema>;
