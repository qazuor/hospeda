import { sql } from 'drizzle-orm';
import { check, integer, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { catalogKeys } from './catalog-key.dbschema.ts';
import { verticals } from './vertical.dbschema.ts';

/** Consumption in one monthly window; the current grant is read from sources. */
export const quotaWindows = pgTable(
    'cuota_ventana',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        vertical: varchar('vertical', { length: 32 })
            .notNull()
            .references(() => verticals.id),
        key: varchar('key', { length: 64 })
            .notNull()
            .references(() => catalogKeys.key),
        opensAt: timestamp('opens_at', { withTimezone: true }).notNull(),
        closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
        consumed: integer('consumed').notNull().default(0)
    },
    (t) => ({
        windowUnique: unique('uq_cuota_ventana_user_vertical_key_opens').on(
            t.userId,
            t.vertical,
            t.key,
            t.opensAt
        ),
        closesAfterOpens: check(
            'ck_cuota_ventana_closes_after_opens',
            sql`${t.closesAt} > ${t.opensAt}`
        ),
        nonnegativeConsumed: check('ck_cuota_ventana_consumed_nonnegative', sql`${t.consumed} >= 0`)
    })
);

export type SelectQuotaWindow = typeof quotaWindows.$inferSelect;
