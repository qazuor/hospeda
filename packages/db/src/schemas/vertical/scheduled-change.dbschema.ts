import { sql } from 'drizzle-orm';
import {
    check,
    foreignKey,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    unique,
    uuid
} from 'drizzle-orm/pg-core';
import { billingOptions } from './billing-option.dbschema.ts';
import { planMigrationSubscriptions } from './plan-migration.dbschema.ts';
import { subscriptions } from './subscription.dbschema.ts';

/**
 * Pending entitlement change for a subscription (AC:B3:29; ESQ:3).
 * The unique subscription FK permits at most one queued change; the destination
 * billing option must belong to the destination plan version. An optional FK records
 * the plan-migration subscription that queued it. keepSelection stores limit keys
 * mapped to selected string values (Coord-23 D1).
 */
export const subscriptionScheduledChanges = pgTable(
    'subscription_scheduled_change',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** suscripción */
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => subscriptions.id),
        /** versión de plan destino */
        targetPlanVersionId: uuid('target_plan_version_id').notNull(),
        /** billing option destino */
        targetBillingOptionId: uuid('target_billing_option_id').notNull(),
        /** fecha efectiva */
        effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
        /** migración que lo encoló, si corresponde */
        planMigrationSubscriptionId: uuid('plan_migration_subscription_id').references(
            () => planMigrationSubscriptions.id
        ),
        /** elección de qué conservar */
        keepSelection: jsonb('keep_selection').$type<Record<string, string[]>>(),
        /** solicitado_en */
        requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
        /**
         * Number of failed S38 attempts recorded for this queue row. The scheduler
         * increments it outside the failed transaction, so a rollback never hides it.
         * Defaults to 0 when the row is seeded or replaced.
         */
        attemptCount: integer('attempt_count').notNull().default(0),
        /** When the most recent failed attempt was recorded. NULL before the first failure. */
        lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
        /** Message of the most recent failed attempt (no stack, at most 500 chars). */
        lastError: text('last_error')
    },
    (t) => ({
        subscriptionUnique: unique('uq_subscription_scheduled_change_subscription').on(
            t.subscriptionId
        ),
        attemptCountCheck: check(
            'ck_subscription_scheduled_change_attempt_count_nonnegative',
            sql`${t.attemptCount} >= 0`
        ),
        targetOptionFk: foreignKey({
            name: 'fk_scheduled_change_target_option',
            columns: [t.targetBillingOptionId, t.targetPlanVersionId],
            foreignColumns: [billingOptions.id, billingOptions.planVersionId]
        }),
        targetVersionIndex: index('ix_subscription_scheduled_change_target_version').on(
            t.targetPlanVersionId
        )
    })
);

/** Insert shape for a scheduled subscription change. */
export type InsertSubscriptionScheduledChange = typeof subscriptionScheduledChanges.$inferInsert;
/** Select shape for a scheduled subscription change. */
export type SelectSubscriptionScheduledChange = typeof subscriptionScheduledChanges.$inferSelect;
