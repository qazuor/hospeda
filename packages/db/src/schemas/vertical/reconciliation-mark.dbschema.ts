import { sql } from 'drizzle-orm';
import {
    check,
    index,
    integer,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { addonInstances } from './addon-product.dbschema.ts';
import { billingDeadlineVersions } from './billing-deadline-version.dbschema.ts';
import { quotedList } from './quoted-list.ts';
import { RECONCILIATION_MARK_REASONS } from './reconciliation-mark-reasons.ts';
import { subscriptions } from './subscription.dbschema.ts';

/** A separate reconciliation mark with a closed MOT:1–MOT:24 reason (B3.md AC:B3:13–16). */
export const reconciliationMarks = pgTable(
    'reconciliation_mark',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** suscripción */
        subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
        /** instancia de addon UNA_VEZ, sólo MOT:23 */
        addonInstanceId: uuid('addon_instance_id').references(() => addonInstances.id),
        /** motivo */
        reason: varchar('reason', { length: 64 }).notNull(),
        /** puesta_en */
        placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
        /** levantada_en */
        liftedAt: timestamp('lifted_at', { withTimezone: true }),
        /** quién la levantó */
        liftedBy: uuid('lifted_by').references(() => users.id),
        /** versión optimista de la marca (cap. 03 §10.3) */
        version: integer('version').notNull().default(1),
        /** Version of billing deadlines captured when opened; null marks pre-HOS-1607 rows and reads the current version. */
        deadlinesVersion: integer('deadlines_version').references(
            () => billingDeadlineVersions.version
        ),
        /** Instant this open mark escalated; null means it has not escalated. */
        escalatedAt: timestamp('escalated_at', { withTimezone: true })
    },
    (t) => ({
        reasonCheck: check(
            'ck_reconciliation_mark_reason',
            sql`${t.reason} IN (${quotedList(RECONCILIATION_MARK_REASONS)})`
        ),
        oneReference: check(
            'ck_reconciliation_mark_one_reference',
            sql`(${t.subscriptionId} IS NOT NULL) <> (${t.addonInstanceId} IS NOT NULL)`
        ),
        instanceOnlyForOrder: check(
            'ck_reconciliation_mark_instance_only_for_order',
            sql`(${t.addonInstanceId} IS NOT NULL) = (${t.reason} = 'ORDEN_PAGADA_SIN_INSTANCIA')`
        ),
        liftedPair: check(
            'ck_reconciliation_mark_lifted_pair',
            sql`(${t.liftedAt} IS NULL) = (${t.liftedBy} IS NULL)`
        ),
        versionPositive: check('ck_reconciliation_mark_version_positive', sql`${t.version} >= 1`),
        openSubscriptionReason: uniqueIndex('uq_reconciliation_mark_open_subscription_reason')
            .on(t.subscriptionId, t.reason)
            .where(sql`${t.liftedAt} IS NULL`),
        openAddonInstanceReason: uniqueIndex('uq_reconciliation_mark_open_addon_instance_reason')
            .on(t.addonInstanceId, t.reason)
            .where(sql`${t.liftedAt} IS NULL`),
        openUnescalated: index('ix_reconciliation_mark_open_unescalated')
            .on(t.placedAt)
            .where(sql`${t.liftedAt} IS NULL AND ${t.escalatedAt} IS NULL`)
    })
);

/** Insert shape of a reconciliation mark (B3.md AC:B3:13–16). */
export type InsertReconciliationMark = typeof reconciliationMarks.$inferInsert;
/** Selected reconciliation mark (B3.md AC:B3:13–16). */
export type SelectReconciliationMark = typeof reconciliationMarks.$inferSelect;
