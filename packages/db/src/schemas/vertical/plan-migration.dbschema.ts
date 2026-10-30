import { sql } from 'drizzle-orm';
import {
    check,
    foreignKey,
    integer,
    pgTable,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { billingDeadlineVersions } from './billing-deadline-version.dbschema.ts';
import { planVersions } from './plan-catalog.dbschema.ts';
import { quotedList } from './quoted-list.ts';
import { subscriptions } from './subscription.dbschema.ts';
import { verticals } from './vertical.dbschema.ts';

export const PLAN_MIGRATION_REASONS = ['RETIREMENT', 'PRICE_INCREASE'] as const;
export const PLAN_MIGRATION_SUBSCRIPTION_STATUSES = [
    'PENDIENTE',
    'APLICADA',
    'FUERA',
    'PARA_RESOLVER',
    'CANCELADA'
] as const;
export const PLAN_MIGRATION_OUT_REASONS = ['CAMBIO_DE_PLAN', 'SE_DIO_DE_BAJA', 'TERMINO'] as const;

/**
 * Announced migration between distinct plan versions in the same vertical
 * (AC:B3:29; ESQ:5). Both version FKs include the vertical; the notice is at least
 * 60 days, and cancellation time and cancelling user are recorded together.
 * FKs also identify the deadline version and signing user.
 */
export const planMigrations = pgTable(
    'plan_migration',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** vertical */
        vertical: varchar('vertical', { length: 32 })
            .notNull()
            .references(() => verticals.id),
        /** versión retirada */
        sourcePlanVersionId: uuid('source_plan_version_id').notNull(),
        /** versión destino */
        targetPlanVersionId: uuid('target_plan_version_id').notNull(),
        /** motivo */
        reason: varchar('reason', { length: 16 }).notNull(),
        /** anunciada_en */
        announcedAt: timestamp('announced_at', { withTimezone: true }).notNull(),
        /** plazo del aviso */
        noticeDays: integer('notice_days').notNull(),
        /** versión de plazos */
        deadlineVersion: integer('deadline_version')
            .notNull()
            .references(() => billingDeadlineVersions.version),
        /** quién la firmó */
        signedBy: uuid('signed_by')
            .notNull()
            .references(() => users.id),
        /** cancelada_en */
        cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
        /** quién la canceló */
        cancelledBy: uuid('cancelled_by').references(() => users.id),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        sourceVerticalFk: foreignKey({
            name: 'fk_plan_migration_source_vertical',
            columns: [t.sourcePlanVersionId, t.vertical],
            foreignColumns: [planVersions.id, planVersions.vertical]
        }),
        targetVerticalFk: foreignKey({
            name: 'fk_plan_migration_target_vertical',
            columns: [t.targetPlanVersionId, t.vertical],
            foreignColumns: [planVersions.id, planVersions.vertical]
        }),
        reasonCheck: check(
            'ck_plan_migration_reason',
            sql`${t.reason} IN (${quotedList(PLAN_MIGRATION_REASONS)})`
        ),
        noticeDaysCheck: check('ck_plan_migration_notice_days', sql`${t.noticeDays} >= 60`),
        cancelTogether: check(
            'ck_plan_migration_cancel_together',
            sql`(${t.cancelledAt} IS NULL) = (${t.cancelledBy} IS NULL)`
        ),
        distinctVersions: check(
            'ck_plan_migration_distinct_versions',
            sql`${t.sourcePlanVersionId} <> ${t.targetPlanVersionId}`
        )
    })
);

/**
 * One subscription's participation in a plan migration (AC:B3:29; ESQ:5).
 * The migration/subscription pair is unique and a subscription has at most one
 * PENDIENTE row. FUERA requires its reason; APLICADA requires its applied timestamp.
 * FKs point to the announced migration and the affected subscription.
 */
export const planMigrationSubscriptions = pgTable(
    'plan_migration_subscription',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** migración */
        planMigrationId: uuid('plan_migration_id')
            .notNull()
            .references(() => planMigrations.id),
        /** suscripción */
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => subscriptions.id),
        /** fecha de aplicación */
        applicationDate: timestamp('application_date', { withTimezone: true }).notNull(),
        /** estado */
        status: varchar('status', { length: 16 }).notNull(),
        /** motivo de FUERA */
        outReason: varchar('out_reason', { length: 16 }),
        /** aplicada_en */
        appliedAt: timestamp('applied_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        statusCheck: check(
            'ck_plan_migration_subscription_status',
            sql`${t.status} IN (${quotedList(PLAN_MIGRATION_SUBSCRIPTION_STATUSES)})`
        ),
        outReasonValues: check(
            'ck_plan_migration_subscription_out_reason_values',
            sql`${t.outReason} IN (${quotedList(PLAN_MIGRATION_OUT_REASONS)})`
        ),
        outReasonCheck: check(
            'ck_plan_migration_subscription_out_reason',
            sql`(${t.status} = 'FUERA') = (${t.outReason} IS NOT NULL)`
        ),
        appliedCheck: check(
            'ck_plan_migration_subscription_applied',
            sql`(${t.status} = 'APLICADA') = (${t.appliedAt} IS NOT NULL)`
        ),
        pairUnique: unique('uq_plan_migration_subscription_pair').on(
            t.planMigrationId,
            t.subscriptionId
        ),
        onePending: uniqueIndex('uq_plan_migration_subscription_one_pending')
            .on(t.subscriptionId)
            .where(sql`${t.status} = 'PENDIENTE'`)
    })
);

/** Insert shape for a plan migration. */
export type InsertPlanMigration = typeof planMigrations.$inferInsert;
/** Select shape for a plan migration. */
export type SelectPlanMigration = typeof planMigrations.$inferSelect;
/** Insert shape for a subscription in a plan migration. */
export type InsertPlanMigrationSubscription = typeof planMigrationSubscriptions.$inferInsert;
/** Select shape for a subscription in a plan migration. */
export type SelectPlanMigrationSubscription = typeof planMigrationSubscriptions.$inferSelect;
