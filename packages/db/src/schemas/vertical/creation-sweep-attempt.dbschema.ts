import { sql } from 'drizzle-orm';
import { check, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { subscriptions } from './subscription.dbschema.ts';

/** Per-subscription search cadence for pending Mercado Pago creations (HOS-1999). */
export const creationSweepAttempts = pgTable(
    'creation_sweep_attempt',
    {
        subscriptionId: uuid('subscription_id')
            .primaryKey()
            .references(() => subscriptions.id, { onDelete: 'cascade' }),
        attempts: integer('attempts').notNull().default(0),
        nextSearchAt: timestamp('next_search_at', { withTimezone: true }).notNull(),
        resetMarker: varchar('reset_marker', { length: 255 })
    },
    (table) => ({
        attemptsCheck: check('ck_creation_sweep_attempts_nonnegative', sql`${table.attempts} >= 0`)
    })
);

/** Insert shape for one creation sweep cadence row. */
export type InsertCreationSweepAttempt = typeof creationSweepAttempts.$inferInsert;
/** Select shape for one creation sweep cadence row. */
export type SelectCreationSweepAttempt = typeof creationSweepAttempts.$inferSelect;
