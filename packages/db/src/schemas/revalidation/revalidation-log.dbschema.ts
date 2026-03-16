import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Revalidation log table
 * Audit log for every on-demand ISR revalidation attempt, recording the path
 * revalidated, what triggered it, who triggered it, the outcome, and optional
 * diagnostic metadata.
 */
export const revalidationLog = pgTable(
    'revalidation_log',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        path: text('path').notNull(),
        entityType: text('entity_type').notNull(),
        entityId: text('entity_id'),
        trigger: text('trigger').notNull(), // 'manual' | 'hook' | 'cron' | 'stale'
        triggeredBy: text('triggered_by'), // userId or 'system'
        status: text('status').notNull().default('success'), // 'success' | 'failed' | 'skipped'
        durationMs: integer('duration_ms'),
        errorMessage: text('error_message'),
        metadata: jsonb('metadata'),
        createdAt: timestamp('created_at').notNull().defaultNow()
    },
    (table) => ({
        entityTypeIdx: index('revalidation_log_entity_type_idx').on(table.entityType),
        triggerIdx: index('revalidation_log_trigger_idx').on(table.trigger),
        createdAtIdx: index('revalidation_log_created_at_idx').on(table.createdAt),
        pathIdx: index('revalidation_log_path_idx').on(table.path)
    })
);
