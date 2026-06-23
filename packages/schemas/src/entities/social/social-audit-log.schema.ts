import { z } from 'zod';

/**
 * SocialAuditLog entity schema.
 * Append-only semantic audit trail for all state transitions and admin actions
 * across the social automation pipeline.
 *
 * NO soft-delete columns and NO audit FKs by design — this is a permanent
 * compliance record. `actorId` has no FK constraint so the log survives user deletion.
 */
export const SocialAuditLogSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialAuditLog.id.uuid' }),
    /**
     * Acting user UUID. Nullable — system/cron events have no actor.
     * No FK constraint by design: audit rows must survive user deletion.
     */
    actorId: z.string().uuid({ message: 'zodError.socialAuditLog.actorId.uuid' }).optional(),
    /**
     * Semantic event type, e.g. "POST_APPROVED", "POST_REJECTED",
     * "POST_SCHEDULED", "TARGET_PUBLISHED", "HASHTAG_PROMOTED",
     * "SETTING_UPDATED", "TARGET_DISPATCH_FAILED_EXHAUSTED".
     */
    eventType: z.string().min(1, { message: 'zodError.socialAuditLog.eventType.required' }),
    /** Type of entity being audited, e.g. "social_post", "social_post_target" */
    entityType: z.string().min(1, { message: 'zodError.socialAuditLog.entityType.required' }),
    /** UUID of the entity being audited (stored as text for flexibility) */
    entityId: z.string().min(1, { message: 'zodError.socialAuditLog.entityId.required' }),
    /** Entity state before the transition. Null for creation events. */
    oldValueJson: z.record(z.string(), z.unknown()).optional(),
    /** Entity state after the transition. */
    newValueJson: z.record(z.string(), z.unknown()).optional(),
    /** Extra context bag (e.g. reason, feedback, warnings). */
    metadataJson: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.coerce.date({ message: 'zodError.common.createdAt.required' })
});

/** TypeScript type inferred from {@link SocialAuditLogSchema}. */
export type SocialAuditLog = z.infer<typeof SocialAuditLogSchema>;
