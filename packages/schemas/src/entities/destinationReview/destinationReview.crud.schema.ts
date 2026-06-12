import { z } from 'zod';
import { DestinationReviewIdSchema } from '../../common/id.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import { DestinationReviewSchema } from './destinationReview.schema.js';

/**
 * Destination Review CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for destination reviews:
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
 * Schema for creating a new destination review.
 * Omits auto-generated fields, audit fields, and moderation fields
 * (the service sets moderationState to PENDING; it is not user-settable via HTTP).
 */
export const DestinationReviewCreateInputSchema = DestinationReviewSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    averageRating: true, // Computed/denormalized field, not user-settable
    moderationState: true,
    moderatedById: true,
    moderatedAt: true,
    moderationReason: true
}).strict();

/**
 * Body-only variant of {@link DestinationReviewCreateInputSchema} for HTTP
 * routes where `destinationId` is sourced from the URL path and `userId`
 * is resolved from the authenticated actor. Validating against this variant
 * lets the client POST just the review payload (rating + optional title +
 * optional content) without redundantly echoing identifiers the server
 * already knows.
 *
 * The original input schema remains intact (service-layer callers and admin
 * tooling still pass the full payload), per the schemas additive-only policy.
 */
export const DestinationReviewCreateBodySchema = DestinationReviewCreateInputSchema.omit({
    destinationId: true,
    userId: true
});

/**
 * Type for the body-only variant of the destination review create input.
 * Contains only the review payload fields (rating + optional title + optional content).
 */
export type DestinationReviewCreateBody = z.infer<typeof DestinationReviewCreateBodySchema>;

/**
 * Schema for destination review creation response
 * Returns the complete destination review object
 */
export const DestinationReviewCreateOutputSchema = DestinationReviewSchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating a destination review (PUT - complete replacement).
 * Omits auto-generated fields, moderation fields, and makes all fields partial
 * except required ones. Moderation fields are managed through the dedicated
 * moderation endpoint, not through standard CRUD operations.
 */
// Zod 4 .partial() keeps .default(); strip them so absent keys = no change (SPEC-217).
export const DestinationReviewUpdateInputSchema = z
    .object(
        stripShapeDefaults(
            DestinationReviewSchema.omit({
                id: true,
                createdAt: true,
                updatedAt: true,
                createdById: true,
                updatedById: true,
                deletedAt: true,
                deletedById: true,
                userId: true, // Cannot change the user who wrote the review
                destinationId: true, // Cannot change the destination being reviewed
                averageRating: true, // Computed/denormalized field, not user-settable
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
 * Schema for partial destination review updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const DestinationReviewPatchInputSchema = DestinationReviewUpdateInputSchema;

/**
 * Schema for destination review update response
 * Returns the complete updated destination review object
 */
export const DestinationReviewUpdateOutputSchema = DestinationReviewSchema;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for destination review deletion input
 * Requires ID and optional force flag for hard delete
 */
export const DestinationReviewDeleteInputSchema = z.object({
    id: DestinationReviewIdSchema,
    force: z
        .boolean({
            message: 'zodError.destinationReview.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for destination review deletion response
 * Returns success status and deletion timestamp
 */
export const DestinationReviewDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.destinationReview.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.destinationReview.delete.deletedAt.invalidType'
        })
        .optional()
});

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for destination review restoration input
 * Requires only the destination review ID
 */
export const DestinationReviewRestoreInputSchema = z.object({
    id: DestinationReviewIdSchema
});

/**
 * Schema for destination review restoration response
 * Returns the complete restored destination review object
 */
export const DestinationReviewRestoreOutputSchema = DestinationReviewSchema;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DestinationReviewCreateInput = z.infer<typeof DestinationReviewCreateInputSchema>;
export type DestinationReviewCreateOutput = z.infer<typeof DestinationReviewCreateOutputSchema>;
export type DestinationReviewUpdateInput = z.infer<typeof DestinationReviewUpdateInputSchema>;
export type DestinationReviewPatchInput = z.infer<typeof DestinationReviewPatchInputSchema>;
export type DestinationReviewUpdateOutput = z.infer<typeof DestinationReviewUpdateOutputSchema>;
export type DestinationReviewDeleteInput = z.infer<typeof DestinationReviewDeleteInputSchema>;
export type DestinationReviewDeleteOutput = z.infer<typeof DestinationReviewDeleteOutputSchema>;
export type DestinationReviewRestoreInput = z.infer<typeof DestinationReviewRestoreInputSchema>;
export type DestinationReviewRestoreOutput = z.infer<typeof DestinationReviewRestoreOutputSchema>;
