import { z } from 'zod';
import { AccommodationReviewIdSchema } from '../../common/id.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import { AccommodationReviewSchema } from './accommodationReview.schema.js';

/**
 * Accommodation Review CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for accommodation reviews:
 * - Create (input/output)
 * - Update (input/output)
 * - Patch (input)
 * - Delete (input/output)
 * - Restore (input/output)
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new accommodation review
 * Omits auto-generated fields like id, audit fields, and moderation fields
 * (the service sets moderationState; it is not user-settable via HTTP).
 */
export const AccommodationReviewCreateInputSchema = AccommodationReviewSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    averageRating: true,
    moderationState: true,
    moderatedById: true,
    moderatedAt: true,
    moderationReason: true
});

/**
 * Body-only variant of {@link AccommodationReviewCreateInputSchema} for HTTP
 * routes where `accommodationId` is sourced from the URL path and `userId`
 * is resolved from the authenticated actor. Validating against this variant
 * lets the client POST just the review payload (rating + optional title +
 * optional content) without redundantly echoing identifiers the server
 * already knows.
 *
 * The original input schema remains intact (service-layer callers and admin
 * tooling still pass the full payload), per the schemas additive-only policy.
 *
 * `.strict()` (HTTP boundary hardening, mirrors DestinationReviewCreateBodySchema):
 * a body that echoes `userId` or `accommodationId` is REJECTED instead of
 * silently stripped, so impersonation attempts fail loudly at validation.
 * Strictness is applied only at this HTTP boundary — the service-layer
 * create input schema stays lax per the additive-only compat policy.
 */
export const AccommodationReviewCreateBodySchema = AccommodationReviewCreateInputSchema.omit({
    accommodationId: true,
    userId: true
}).strict();

/**
 * Schema for accommodation review creation response
 * Returns the complete accommodation review object
 */
export const AccommodationReviewCreateOutputSchema = AccommodationReviewSchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating an accommodation review (PUT - complete replacement).
 * Omits auto-generated fields, moderation fields, and makes all fields partial.
 *
 * SPEC-063-gaps T-017 (GAP-016, defense-in-depth): `.strict()` enforces that
 * unknown keys are rejected at the route boundary with a 400 VALIDATION_ERROR
 * instead of being silently dropped by the Hono zValidator middleware.
 * Moderation fields are omitted — they are managed through the dedicated
 * moderation endpoint, not through standard CRUD operations.
 */
// Zod 4 .partial() keeps .default(); strip them so absent keys = no change (SPEC-217).
export const AccommodationReviewUpdateInputSchema = z
    .object(
        stripShapeDefaults(
            AccommodationReviewSchema.omit({
                id: true,
                createdAt: true,
                updatedAt: true,
                createdById: true,
                updatedById: true,
                deletedAt: true,
                deletedById: true,
                averageRating: true,
                moderationState: true,
                moderatedById: true,
                moderatedAt: true,
                moderationReason: true
            }).shape
        )
    )
    .partial()
    .strict();

/**
 * Schema for partial accommodation review updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const AccommodationReviewPatchInputSchema = AccommodationReviewUpdateInputSchema;

/**
 * Schema for accommodation review update response
 * Returns the complete updated accommodation review object
 */
export const AccommodationReviewUpdateOutputSchema = AccommodationReviewSchema;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for accommodation review deletion input
 * Requires ID and optional force flag for hard delete
 */
export const AccommodationReviewDeleteInputSchema = z.object({
    id: AccommodationReviewIdSchema,
    force: z
        .boolean({
            message: 'zodError.accommodationReview.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for accommodation review deletion response
 * Returns success status and deletion timestamp
 */
export const AccommodationReviewDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.accommodationReview.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.accommodationReview.delete.deletedAt.invalidType'
        })
        .optional()
});

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for accommodation review restoration input
 * Requires only the accommodation review ID
 */
export const AccommodationReviewRestoreInputSchema = z.object({
    id: AccommodationReviewIdSchema
});

/**
 * Schema for accommodation review restoration response
 * Returns the complete restored accommodation review object
 */
export const AccommodationReviewRestoreOutputSchema = AccommodationReviewSchema;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AccommodationReviewCreateInput = z.infer<typeof AccommodationReviewCreateInputSchema>;
export type AccommodationReviewCreateOutput = z.infer<typeof AccommodationReviewCreateOutputSchema>;
export type AccommodationReviewUpdateInput = z.infer<typeof AccommodationReviewUpdateInputSchema>;
export type AccommodationReviewPatchInput = z.infer<typeof AccommodationReviewPatchInputSchema>;
export type AccommodationReviewUpdateOutput = z.infer<typeof AccommodationReviewUpdateOutputSchema>;
export type AccommodationReviewDeleteInput = z.infer<typeof AccommodationReviewDeleteInputSchema>;
export type AccommodationReviewDeleteOutput = z.infer<typeof AccommodationReviewDeleteOutputSchema>;
export type AccommodationReviewRestoreInput = z.infer<typeof AccommodationReviewRestoreInputSchema>;
export type AccommodationReviewRestoreOutput = z.infer<
    typeof AccommodationReviewRestoreOutputSchema
>;
