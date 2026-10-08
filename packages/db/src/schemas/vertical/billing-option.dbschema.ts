import { sql } from 'drizzle-orm';
import { check, integer, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { planVersions } from './plan-catalog.dbschema.ts';

/** A cycle and its ARS price, attached to one immutable plan version (AC:B2:1). */
export const billingOptions = pgTable(
    'billing_option',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        planVersionId: uuid('plan_version_id')
            .notNull()
            .references(() => planVersions.id),
        cycle: varchar('cycle', { length: 16 }).notNull(),
        amount: integer('amount').notNull(),
        currency: varchar('currency', { length: 3 }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        versionCycleUnique: unique('uq_billing_option_version_cycle').on(t.planVersionId, t.cycle),
        idVersionUnique: unique('uq_billing_option_id_version').on(t.id, t.planVersionId),
        cycleCheck: check(
            'ck_billing_option_cycle',
            sql`${t.cycle} IN ('monthly', 'quarterly', 'semiannual', 'annual')`
        ),
        currencyCheck: check('ck_billing_option_currency', sql`${t.currency} = 'ARS'`)
    })
);

/** Insert shape for a billing option. */
export type InsertBillingOption = typeof billingOptions.$inferInsert;
/** Select shape for a billing option. */
export type SelectBillingOption = typeof billingOptions.$inferSelect;
