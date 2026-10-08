import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
    check,
    foreignKey,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
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

/** A vertical subscription and its anchored billing identity (AC:B3:29). */
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
