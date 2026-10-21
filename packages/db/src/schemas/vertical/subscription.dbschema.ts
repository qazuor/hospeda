import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
    check,
    foreignKey,
    integer,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { billingDeadlineVersions } from './billing-deadline-version.dbschema.ts';
import { billingOptions } from './billing-option.dbschema.ts';
import { planVersions } from './plan-catalog.dbschema.ts';
import { quotedList } from './quoted-list.ts';
import { verticals } from './vertical.dbschema.ts';

export const SUBSCRIPTION_PAYMENT_METHODS = ['CARD', 'MANUAL'] as const;
export const SUBSCRIPTION_STATUSES = [
    'PENDING_AUTHORIZATION',
    'ABANDONED',
    'ACTIVE',
    'GRACE_PERIOD',
    'PAUSED',
    'SUSPENDED',
    'CANCEL_SCHEDULED',
    'CANCELLED',
    'CHARGE_DECLINED'
] as const;
export const SUBSCRIPTION_CLASSES = ['PRINCIPAL', 'COMPLEMENTO', 'LAPIDA'] as const;
export const LIVE_SUBSCRIPTION_STATUSES = [
    'PENDING_AUTHORIZATION',
    'ACTIVE',
    'GRACE_PERIOD',
    'PAUSED',
    'SUSPENDED',
    'CANCEL_SCHEDULED'
] as const;

/**
 * A vertical subscription, created in this cut (AC:B3:29; Coord-21).
 * Live principal commitments are unique per user and vertical for each origin/successor
 * slot; a row cannot point both ways, and a tombstone is cancelled (AC:B3:7; ESQ:4).
 * Principals anchor a plan version and billing option, while COMPLEMENTO and LAPIDA
 * are exempt; non-tombstones require a user, vertical and payment method (DJ; Coord-23 D3).
 * FKs link the user, vertical, predecessor/successor, and matching option/version/vertical.
 * La ventana de autorización guarda su versión de plazos y su vencimiento juntos (PLAZO:10).
 * El reloj del grace guarda el rechazo leído y su vencimiento juntos (S4); S5/S6 lo apagan al salir del grace (B7.2).
 * El aviso de renovación guarda su versión de plazos y la fecha del cobro para la que la guardó, juntos (PLAZO:13).
 */
export const subscriptions = pgTable(
    'subscription',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** user */
        userId: uuid('user_id').references(() => users.id),
        /** vertical */
        vertical: varchar('vertical', { length: 32 }).references(() => verticals.id),
        /** versión anclada */
        planVersionId: uuid('plan_version_id'),
        /** billing option */
        billingOptionId: uuid('billing_option_id'),
        /** método */
        paymentMethod: varchar('payment_method', { length: 16 }),
        /** estado */
        status: varchar('status', { length: 32 }).notNull(),
        /** clase */
        class: varchar('class', { length: 16 }).notNull(),
        /** fecha del próximo cobro */
        nextChargeAt: timestamp('next_charge_at', { withTimezone: true }),
        /** fecha de fin de servicio */
        serviceEndsAt: timestamp('service_ends_at', { withTimezone: true }),
        /** fecha de primer cobro con la que nació */
        firstChargeAt: timestamp('first_charge_at', { withTimezone: true }),
        /**
         * The email the payer DECLARED for this row's authorization attempt; sent to the provider
         * as `payer_email`, read by the creations sweep to find the loose preapproval, and read by
         * S1 to compare a retry email and decide whether the attempt is replaced (HOS-1732).
         * It is NEVER a confirmed email (the provider returns `payer_email` empty on a read), and
         * no code may read it as the payer's identity.
         */
        declaredPayerEmail: varchar('declared_payer_email', { length: 255 }),
        /** versión de plazos de la ventana (PLAZO:10) */
        authorizationWindowDeadlineVersion: integer(
            'authorization_window_deadline_version'
        ).references(() => billingDeadlineVersions.version),
        /** vence la ventana de autorización */
        authorizationWindowEndsAt: timestamp('authorization_window_ends_at', {
            withTimezone: true
        }),
        /** Instante en que S4 leyó el rechazo que abrió el grace. */
        graceStartedAt: timestamp('grace_started_at', { withTimezone: true }),
        /** Vencimiento calculado del grace; S5/S7 lo vacían al salir; S6 lo conserva como ancla del período impago. */
        graceEndsAt: timestamp('grace_ends_at', { withTimezone: true }),
        /** versión de plazos del aviso de renovación de este ciclo (PLAZO:13) */
        renewalNoticeDeadlineVersion: integer('renewal_notice_deadline_version').references(
            () => billingDeadlineVersions.version
        ),
        /** la fecha del próximo cobro para la que se guardó esa versión */
        renewalNoticeChargeAt: timestamp('renewal_notice_charge_at', { withTimezone: true }),
        /** sucede_a */
        succeedsId: uuid('succeeds_id').references((): AnyPgColumn => subscriptions.id),
        /** sucedida_por */
        succeededById: uuid('succeeded_by_id').references((): AnyPgColumn => subscriptions.id),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        paymentMethodCheck: check(
            'ck_subscription_payment_method',
            sql`${t.paymentMethod} IN (${quotedList(SUBSCRIPTION_PAYMENT_METHODS)})`
        ),
        statusCheck: check(
            'ck_subscription_status',
            sql`${t.status} IN (${quotedList(SUBSCRIPTION_STATUSES)})`
        ),
        classCheck: check(
            'ck_subscription_class',
            sql`${t.class} IN (${quotedList(SUBSCRIPTION_CLASSES)})`
        ),
        successionExclusive: check(
            'ck_subscription_succession_exclusive',
            sql`NOT (${t.succeedsId} IS NOT NULL AND ${t.succeededById} IS NOT NULL)`
        ),
        tombstoneCancelled: check(
            'ck_subscription_tombstone_cancelled',
            sql`${t.class} <> 'LAPIDA' OR ${t.status} = 'CANCELLED'`
        ),
        identityNotNull: check(
            'ck_subscription_identity_not_null',
            sql`${t.class} = 'LAPIDA' OR (${t.userId} IS NOT NULL AND ${t.vertical} IS NOT NULL AND ${t.paymentMethod} IS NOT NULL)`
        ),
        principalAnchor: check(
            'ck_subscription_principal_anchor',
            sql`${t.class} <> 'PRINCIPAL' OR (${t.planVersionId} IS NOT NULL AND ${t.billingOptionId} IS NOT NULL)`
        ),
        authorizationWindowPair: check(
            'ck_subscription_authorization_window_pair',
            sql`(${t.authorizationWindowDeadlineVersion} IS NULL AND ${t.authorizationWindowEndsAt} IS NULL) OR (${t.authorizationWindowDeadlineVersion} IS NOT NULL AND ${t.authorizationWindowEndsAt} IS NOT NULL)`
        ),
        graceClockPair: check(
            'ck_subscription_grace_clock_pair',
            sql`(${t.graceStartedAt} IS NULL AND ${t.graceEndsAt} IS NULL) OR (${t.graceStartedAt} IS NOT NULL AND ${t.graceEndsAt} IS NOT NULL AND ${t.graceEndsAt} >= ${t.graceStartedAt})`
        ),
        renewalNoticePair: check(
            'ck_subscription_renewal_notice_pair',
            sql`(${t.renewalNoticeDeadlineVersion} IS NULL AND ${t.renewalNoticeChargeAt} IS NULL) OR (${t.renewalNoticeDeadlineVersion} IS NOT NULL AND ${t.renewalNoticeChargeAt} IS NOT NULL)`
        ),
        optionVersionFk: foreignKey({
            name: 'fk_subscription_billing_option_version',
            columns: [t.billingOptionId, t.planVersionId],
            foreignColumns: [billingOptions.id, billingOptions.planVersionId]
        }),
        versionVerticalFk: foreignKey({
            name: 'fk_subscription_version_vertical',
            columns: [t.planVersionId, t.vertical],
            foreignColumns: [planVersions.id, planVersions.vertical]
        }),
        commitmentOrigin: uniqueIndex('uq_subscription_commitment_origin')
            .on(t.userId, t.vertical)
            .where(
                sql`${t.class} = 'PRINCIPAL' AND ${t.succeedsId} IS NULL AND ${t.status} IN (${quotedList(LIVE_SUBSCRIPTION_STATUSES)})`
            ),
        commitmentSuccessor: uniqueIndex('uq_subscription_commitment_successor')
            .on(t.userId, t.vertical)
            .where(
                sql`${t.class} = 'PRINCIPAL' AND ${t.succeedsId} IS NOT NULL AND ${t.status} IN (${quotedList(LIVE_SUBSCRIPTION_STATUSES)})`
            )
    })
);

/** Insert shape for a subscription. */
export type InsertSubscription = typeof subscriptions.$inferInsert;
/** Select shape for a subscription. */
export type SelectSubscription = typeof subscriptions.$inferSelect;
