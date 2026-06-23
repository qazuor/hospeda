import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Social audit log table.
 * Append-only semantic audit trail for all state transitions and admin actions
 * across the social automation pipeline.
 *
 * NO soft-delete columns and NO audit FKs by design — this is a permanent
 * compliance record. actor_id has NO foreign key constraint so that the log
 * survives user deletion (matching the app_log_entries pattern).
 */
export const socialAuditLog = pgTable(
    'social_audit_log',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * Acting user UUID. Nullable — system/cron events have no actor.
         * No FK constraint by design: audit rows must survive user deletion.
         */
        actorId: uuid('actor_id'),
        /**
         * Semantic event type, e.g. "POST_APPROVED", "POST_REJECTED",
         * "POST_SCHEDULED", "TARGET_PUBLISHED", "HASHTAG_PROMOTED",
         * "SETTING_UPDATED", "TARGET_DISPATCH_FAILED_EXHAUSTED".
         */
        eventType: text('event_type').notNull(),
        /** Type of entity being audited, e.g. "social_post", "social_post_target" */
        entityType: text('entity_type').notNull(),
        /** UUID of the entity being audited (stored as text for flexibility) */
        entityId: text('entity_id').notNull(),
        /** Entity state before the transition. Null for creation events. */
        oldValueJson: jsonb('old_value_json').$type<Record<string, unknown>>(),
        /** Entity state after the transition. */
        newValueJson: jsonb('new_value_json').$type<Record<string, unknown>>(),
        /** Extra context bag (e.g. reason, feedback, warnings). */
        metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        socialAuditLog_entityType_entityId_idx: index('socialAuditLog_entityType_entityId_idx').on(
            table.entityType,
            table.entityId
        ),
        socialAuditLog_actorId_idx: index('socialAuditLog_actorId_idx').on(table.actorId),
        socialAuditLog_eventType_idx: index('socialAuditLog_eventType_idx').on(table.eventType),
        socialAuditLog_createdAt_idx: index('socialAuditLog_createdAt_idx').on(
            table.createdAt.desc()
        )
    })
);

export type InsertSocialAuditLog = typeof socialAuditLog.$inferInsert;
export type SelectSocialAuditLog = typeof socialAuditLog.$inferSelect;
