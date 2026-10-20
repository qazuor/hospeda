import type { BillingDeadlineValues } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { check, integer, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Immutable complete billing deadline snapshots. Version 1 is installed by the structural migration. */
export const billingDeadlineVersions = pgTable(
    'billing_deadline_version',
    {
        version: integer('version').primaryKey(),
        values: jsonb('values').$type<BillingDeadlineValues>().notNull(),
        changedKey: integer('changed_key'),
        previousValue: jsonb('previous_value'),
        newValue: jsonb('new_value'),
        changedBy: uuid('changed_by'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        versionPositive: check('ck_billing_deadline_version_positive', sql`${t.version} > 0`),
        changedKeyRange: check(
            'ck_billing_deadline_changed_key_range',
            sql`${t.changedKey} BETWEEN 10 AND 19 OR ${t.changedKey} IS NULL`
        )
    })
);
