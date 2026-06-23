/**
 * @file social-make-callback.schema.ts
 *
 * Zod schemas for the Make.com inbound callback routes:
 *  - POST /api/v1/integrations/make/social/jobs/{targetId}/claim
 *  - POST /api/v1/integrations/make/social/jobs/{targetId}/result
 *
 * These schemas define the request bodies and response shapes for the two
 * Make.com callback endpoints implemented in SPEC-254 T-048.
 *
 * @module schemas/entities/social/social-make-callback
 * @see SPEC-254 T-048, US-12, US-13
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Claim callback (US-12)
// ---------------------------------------------------------------------------

/**
 * Request body for POST /api/v1/integrations/make/social/jobs/{targetId}/claim.
 *
 * Make.com sends this body when it picks up a dispatched job, recording
 * the scenario run ID for correlation and transitioning the target to PUBLISHING.
 */
export const MakeClaimCallbackSchema = z.object({
    /**
     * The Make.com scenario run ID for this dispatch job.
     * Used for correlation in audit logs and publish-log entries.
     */
    makeRunId: z.string().min(1)
});

/** TypeScript type inferred from {@link MakeClaimCallbackSchema}. */
export type MakeClaimCallback = z.infer<typeof MakeClaimCallbackSchema>;

/**
 * Response schema for the claim callback.
 *
 * Echoes the target ID and confirms the new status is PUBLISHING.
 */
export const MakeClaimCallbackResponseSchema = z.object({
    /** The social_post_target ID that was claimed. */
    targetId: z.string().uuid(),
    /** Status after claiming — always PUBLISHING on success. */
    status: z.literal('PUBLISHING')
});

/** TypeScript type inferred from {@link MakeClaimCallbackResponseSchema}. */
export type MakeClaimCallbackResponse = z.infer<typeof MakeClaimCallbackResponseSchema>;

// ---------------------------------------------------------------------------
// Result callback (US-13)
// ---------------------------------------------------------------------------

/**
 * Request body for POST /api/v1/integrations/make/social/jobs/{targetId}/result.
 *
 * Make.com sends this body after attempting to publish to a social platform,
 * reporting whether the publish succeeded or failed.
 */
export const MakeResultCallbackSchema = z.object({
    /**
     * Make-reported outcome — only 'SUCCESS' or 'FAILED' are accepted.
     * Any other value is rejected with a 422 validation error.
     */
    status: z.enum(['SUCCESS', 'FAILED']),
    /**
     * External post ID on the social platform (e.g. Instagram media ID).
     * Present on SUCCESS path.
     */
    externalPostId: z.string().optional(),
    /**
     * Public URL of the published social post.
     * Must be a valid URL when provided.
     */
    externalPostUrl: z.string().url().optional(),
    /**
     * Make.com scenario run ID for traceability.
     * Optional — included for correlation with the claim callback.
     */
    makeRunId: z.string().optional(),
    /**
     * Human-readable error description.
     * Present on FAILED path.
     */
    errorMessage: z.string().optional()
});

/** TypeScript type inferred from {@link MakeResultCallbackSchema}. */
export type MakeResultCallback = z.infer<typeof MakeResultCallbackSchema>;

/**
 * Response schema for the result callback.
 *
 * Echoes the target ID and the final status after processing the callback.
 */
export const MakeResultCallbackResponseSchema = z.object({
    /** The social_post_target ID the result was applied to. */
    targetId: z.string().uuid(),
    /**
     * Final target status after processing:
     * - 'PUBLISHED' on SUCCESS
     * - 'APPROVED'  when retrying (FAILED but under retry limit)
     * - 'FAILED'    when exhausted (FAILED + retry limit reached)
     */
    status: z.enum(['PUBLISHED', 'APPROVED', 'FAILED'])
});

/** TypeScript type inferred from {@link MakeResultCallbackResponseSchema}. */
export type MakeResultCallbackResponse = z.infer<typeof MakeResultCallbackResponseSchema>;
