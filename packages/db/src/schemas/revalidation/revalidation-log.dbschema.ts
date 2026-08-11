import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Revalidation log table
 * Audit log for every CDN cache-invalidation attempt, recording WHAT was
 * invalidated, what triggered it, who triggered it, the outcome, and optional
 * diagnostic metadata.
 *
 * `target` holds a cache tag (`accom-cabana-del-rio`, `list-accom`) or `*` for
 * a whole-zone flush. It was named `path` until HOS-369 W1-1, when purge moved
 * from URLs to cache tags — the rename keeps the column honest about its
 * contents. Historical rows keep their URL paths, which is why the name is the
 * broader `target` rather than `tag`.
 */
export const revalidationLog = pgTable(
    'revalidation_log',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        target: text('target').notNull(),
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
        targetIdx: index('revalidation_log_target_idx').on(table.target)
    })
);
