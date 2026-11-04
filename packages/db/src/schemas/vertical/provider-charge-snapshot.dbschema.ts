import { boolean, integer, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

/** Last observed provider state for one charge. */
export const providerChargeSnapshots = pgTable(
    'provider_charge_snapshot',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        provider: varchar('provider', { length: 255 }).notNull(),
        chargeId: varchar('charge_id', { length: 255 }).notNull(),
        authorizationId: varchar('authorization_id', { length: 255 }),
        providerCreatedAt: timestamp('provider_created_at', { withTimezone: true }).notNull(),
        expiresAt: timestamp('expires_at', { withTimezone: true }),
        status: varchar('status', { length: 32 }).notNull(),
        purpose: varchar('purpose', { length: 64 }).notNull(),
        reference: varchar('reference', { length: 255 }),
        declineReason: varchar('decline_reason', { length: 255 }),
        amountMinor: integer('amount_minor').notNull(),
        refundedAmountMinor: integer('refunded_amount_minor').notNull().default(0),
        currency: varchar('currency', { length: 3 }).notNull(),
        chargedBack: boolean('charged_back').notNull().default(false),
        observedAt: timestamp('observed_at', { withTimezone: true }).notNull()
    },
    (table) => ({
        providerChargeUnique: unique('uq_provider_charge_snapshot_provider_charge').on(
            table.provider,
            table.chargeId
        )
    })
);

/** Insert shape for a provider charge snapshot. */
export type InsertProviderChargeSnapshot = typeof providerChargeSnapshots.$inferInsert;
/** Select shape for a provider charge snapshot. */
export type SelectProviderChargeSnapshot = typeof providerChargeSnapshots.$inferSelect;
