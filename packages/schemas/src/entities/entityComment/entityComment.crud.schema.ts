import { z } from 'zod';
import { ModerationStatusEnum } from '../../enums/index.js';
import { EntityCommentSchema } from './entityComment.schema.js';

/**
 * EntityComment CRUD input schemas (SPEC-165).
 *
 * Comments are not editable after creation (no content-update endpoint in MVP),
 * so there is no generic "update" input. The only mutations are: create,
 * moderation-state change, soft-delete, restore, and hard-delete — the latter
 * three carry no body.
 */

// ============================================================================
// CREATE
// ============================================================================

/**
 * Service-level create input. `authorId` and `moderationState` are NOT part of
 * the input: the service injects `authorId` from the authenticated actor and
 * defaults `moderationState` to APPROVED (publish-immediately, RD-4). `entityType`
 * and `entityId` are resolved from the route path by the HTTP layer.
 */
export const CreateEntityCommentInputSchema = EntityCommentSchema.pick({
    entityType: true,
    entityId: true,
    content: true
}).strict();
export type CreateEntityCommentInput = z.infer<typeof CreateEntityCommentInputSchema>;

// ============================================================================
// MODERATE
// ============================================================================

/**
 * Moderation transition input (PATCH body). Only APPROVED and REJECTED are
 * accepted via the API: the publish-immediately model has no PENDING gate, so an
 * editor only ever toggles a comment between visible (APPROVED) and hidden
 * (REJECTED). SPEC-165 §5.4 / AC-19 / AC-20.
 */
export const ModerateEntityCommentInputSchema = z
    .object({
        moderationState: z.enum([ModerationStatusEnum.APPROVED, ModerationStatusEnum.REJECTED], {
            message: 'zodError.entityComment.moderationState.invalid'
        })
    })
    .strict();
export type ModerateEntityCommentInput = z.infer<typeof ModerateEntityCommentInputSchema>;
