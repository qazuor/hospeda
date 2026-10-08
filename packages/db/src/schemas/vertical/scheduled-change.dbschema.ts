import { foreignKey, index, jsonb, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { billingOptions } from './billing-option.dbschema.ts';
import { planMigrationSubscriptions } from './plan-migration.dbschema.ts';
import { subscriptions } from './subscription.dbschema.ts';

/** The one pending entitlement change for a subscription (ESQ:3). */
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
        requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        subscriptionUnique: unique('uq_subscription_scheduled_change_subscription').on(
            t.subscriptionId
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
