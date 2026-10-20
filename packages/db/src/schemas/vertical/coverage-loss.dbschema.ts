import { pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { verticals } from './vertical.dbschema.ts';

/**
 * The instant of the latest loss of billing coverage of a (user, vertical), written in the same
 * transaction as the drop (contract §4.1, AC:B4:4). `retentionStopped` reads it as
 * `coverageLostAt`. One row per (user, vertical): the latest loss overwrites the previous one.
 */
export const coverageLosses = pgTable(
    'coverage_loss',
    {
        /** user; the loss belongs to the user and goes with it */
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** vertical */
        vertical: varchar('vertical', { length: 32 })
            .notNull()
            .references(() => verticals.id),
        /** instante de la última pérdida de cobertura */
        lostAt: timestamp('lost_at', { withTimezone: true }).notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        pk: primaryKey({ name: 'pk_coverage_loss', columns: [t.userId, t.vertical] })
    })
);

/** Insert shape for a coverage loss (contract §4.1). */
export type InsertCoverageLoss = typeof coverageLosses.$inferInsert;
/** Select shape for a coverage loss (contract §4.1). */
export type SelectCoverageLoss = typeof coverageLosses.$inferSelect;
