import type { VerticalDeadlineValues } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { check, integer, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Immutable complete vertical deadline snapshots. Version 1 is installed by the structural migration. */
export const verticalDeadlineVersions = pgTable(
    'vertical_deadline_version',
    {
        version: integer('version').primaryKey(),
        values: jsonb('values').$type<VerticalDeadlineValues>().notNull(),
        changedKey: integer('changed_key'),
        previousValue: jsonb('previous_value'),
        newValue: jsonb('new_value'),
        changedBy: uuid('changed_by'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        versionPositive: check('ck_vertical_deadline_version_positive', sql`${t.version} > 0`),
        changedKeyRange: check(
            'ck_vertical_deadline_changed_key_range',
            sql`${t.changedKey} BETWEEN 1 AND 9 OR ${t.changedKey} IS NULL`
        )
    })
);
