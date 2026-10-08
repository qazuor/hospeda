import { VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import {
    boolean,
    check,
    integer,
    pgTable,
    timestamp,
    unique,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { quotedList } from './quoted-list.ts';
import { subscriptions } from './subscription.dbschema.ts';

export const PROMO_DISCOUNT_KINDS = ['PERCENTAGE', 'FIXED'] as const;
export const PROMO_DURATION_KINDS = ['FIRST_CHARGE', 'N_CHARGES', 'FOREVER'] as const;

/**
 * Promotion code with a unique code, positive quota, valid time window and
 * bounded discount/duration values (AC:B3:29; ESQ:6). allVerticals plus the
 * optional vertical array defines its scope (Coord-23 D4); closing it records
 * both timestamp and user, with an FK to users.
 */
export const promoCodes = pgTable(
    'promo_code',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** código */
        code: varchar('code', { length: 64 }).notNull(),
        /** tipo de descuento */
        discountKind: varchar('discount_kind', { length: 16 }).notNull(),
        /** valor */
        value: integer('value').notNull(),
        /** todas las verticales, incluidas futuras */
        allVerticals: boolean('all_verticals').notNull(),
        /** verticales elegidas */
        verticals: varchar('verticals', { length: 32 }).array(),
        /** cupo total */
        totalQuota: integer('total_quota').notNull(),
        /** ventana de inicio */
        validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
        /** ventana de fin */
        validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
        /** acumulable */
        stackable: boolean('stackable').notNull(),
        /** usable con otra promo activa */
        usableWithAnotherActive: boolean('usable_with_another_active').notNull(),
        /** duración */
        durationKind: varchar('duration_kind', { length: 16 }).notNull(),
        /** cantidad de cobros */
        durationCharges: integer('duration_charges'),
        /** cerrado_en */
        closedAt: timestamp('closed_at', { withTimezone: true }),
        /** cerrado_por */
        closedBy: uuid('closed_by').references(() => users.id),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        codeUnique: unique('uq_promo_code_code').on(t.code),
        discountKindCheck: check(
            'ck_promo_code_discount_kind',
            sql`${t.discountKind} IN (${quotedList(PROMO_DISCOUNT_KINDS)})`
        ),
        valueCheck: check(
            'ck_promo_code_value',
            sql`${t.value} > 0 AND (${t.discountKind} <> 'PERCENTAGE' OR ${t.value} <= 100)`
        ),
        verticalsCheck: check(
            'ck_promo_code_verticals',
            sql`${t.allVerticals} = (${t.verticals} IS NULL) AND (${t.verticals} IS NULL OR (cardinality(${t.verticals}) >= 1 AND ${t.verticals} <@ ARRAY[${quotedList(Object.values(VerticalEnum))}]::varchar[]))`
        ),
        quotaCheck: check('ck_promo_code_total_quota', sql`${t.totalQuota} > 0`),
        windowCheck: check('ck_promo_code_window', sql`${t.validUntil} > ${t.validFrom}`),
        durationKindCheck: check(
            'ck_promo_code_duration_kind',
            sql`${t.durationKind} IN (${quotedList(PROMO_DURATION_KINDS)})`
        ),
        durationChargesCheck: check(
            'ck_promo_code_duration_charges',
            sql`(${t.durationKind} = 'N_CHARGES') = (${t.durationCharges} IS NOT NULL) AND (${t.durationCharges} IS NULL OR ${t.durationCharges} >= 1)`
        ),
        closeTogether: check(
            'ck_promo_code_close_together',
            sql`(${t.closedAt} IS NULL) = (${t.closedBy} IS NULL)`
        )
    })
);

/**
 * A user's redemption of a promotion on a subscription (AC:B3:29; ESQ:6).
 * Each promo/user pair is unique; remaining charges are nonnegative or null
 * for an unlimited duration. FKs link the code, user and subscription.
 */
export const promoRedemptions = pgTable(
    'promo_redemption',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** código */
        promoCodeId: uuid('promo_code_id')
            .notNull()
            .references(() => promoCodes.id),
        /** user */
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id),
        /** cuándo */
        redeemedAt: timestamp('redeemed_at', { withTimezone: true }).notNull(),
        /** suscripción */
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => subscriptions.id),
        /** cobros_restantes */
        remainingCharges: integer('remaining_charges')
    },
    (t) => ({
        codeUserUnique: unique('uq_promo_redemption_code_user').on(t.promoCodeId, t.userId),
        remainingChargesCheck: check(
            'ck_promo_redemption_remaining_charges',
            sql`${t.remainingCharges} IS NULL OR ${t.remainingCharges} >= 0`
        )
    })
);

/** Insert shape for a promotion code. */
export type InsertPromoCode = typeof promoCodes.$inferInsert;
/** Select shape for a promotion code. */
export type SelectPromoCode = typeof promoCodes.$inferSelect;
/** Insert shape for a promotion redemption. */
export type InsertPromoRedemption = typeof promoRedemptions.$inferInsert;
/** Select shape for a promotion redemption. */
export type SelectPromoRedemption = typeof promoRedemptions.$inferSelect;
