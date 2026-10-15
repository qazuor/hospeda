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
export const PROMO_EFFECT_KINDS = ['DISCOUNT', 'TRIAL_EXTENSION'] as const;

/**
 * Promotion code with a unique code, positive quota, valid time window and
 * bounded discount/duration values (AC:B3:29; ESQ:6). allVerticals plus the
 * optional vertical array defines its scope (Coord-23 D4); closing it records
 * both timestamp and user, with an FK to users. H8 adds the defaulted effect
 * shape needed by AC:B9b:6 while preserving existing discount rows.
 */
export const promoCodes = pgTable(
    'promo_code',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** código */
        code: varchar('code', { length: 64 }).notNull(),
        /** efecto promocional (H8; AC:B9b:6) */
        effectKind: varchar('effect_kind', { length: 16 }).notNull().default('DISCOUNT'),
        /** días de extensión del trial */
        extensionDays: integer('extension_days'),
        /** tipo de descuento */
        discountKind: varchar('discount_kind', { length: 16 }),
        /** valor */
        value: integer('value'),
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
        durationKind: varchar('duration_kind', { length: 16 }),
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
        effectKindCheck: check(
            'ck_promo_code_effect_kind',
            sql`${t.effectKind} IN (${quotedList(PROMO_EFFECT_KINDS)})`
        ),
        discountKindCheck: check(
            'ck_promo_code_discount_kind',
            sql`${t.discountKind} IS NULL OR ${t.discountKind} IN (${quotedList(PROMO_DISCOUNT_KINDS)})`
        ),
        valueCheck: check(
            'ck_promo_code_value',
            sql`${t.value} IS NULL OR (${t.value} > 0 AND (${t.discountKind} IS NULL OR ${t.discountKind} <> 'PERCENTAGE' OR ${t.value} <= 100))`
        ),
        verticalsCheck: check(
            'ck_promo_code_verticals',
            sql`${t.allVerticals} = (${t.verticals} IS NULL) AND (${t.verticals} IS NULL OR (cardinality(${t.verticals}) >= 1 AND ${t.verticals} <@ ARRAY[${quotedList(Object.values(VerticalEnum))}]::varchar[]))`
        ),
        quotaCheck: check('ck_promo_code_total_quota', sql`${t.totalQuota} > 0`),
        windowCheck: check('ck_promo_code_window', sql`${t.validUntil} > ${t.validFrom}`),
        durationKindCheck: check(
            'ck_promo_code_duration_kind',
            sql`${t.durationKind} IS NULL OR ${t.durationKind} IN (${quotedList(PROMO_DURATION_KINDS)})`
        ),
        durationChargesCheck: check(
            'ck_promo_code_duration_charges',
            sql`(${t.durationKind} = 'N_CHARGES') = (${t.durationCharges} IS NOT NULL) AND (${t.durationCharges} IS NULL OR ${t.durationCharges} >= 1)`
        ),
        closeTogether: check(
            'ck_promo_code_close_together',
            sql`(${t.closedAt} IS NULL) = (${t.closedBy} IS NULL)`
        ),
        effectShapeCheck: check(
            'ck_promo_code_effect_shape',
            sql`(${t.effectKind} = 'DISCOUNT' AND ${t.discountKind} IS NOT NULL AND ${t.value} IS NOT NULL AND ${t.durationKind} IS NOT NULL AND ${t.extensionDays} IS NULL) OR (${t.effectKind} = 'TRIAL_EXTENSION' AND ${t.discountKind} IS NULL AND ${t.value} IS NULL AND ${t.durationKind} IS NULL AND ${t.durationCharges} IS NULL AND ${t.extensionDays} IS NOT NULL AND ${t.extensionDays} > 0)`
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
        subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
        /** cobros_restantes */
        remainingCharges: integer('remaining_charges')
    },
    (t) => ({
        codeUserUnique: unique('uq_promo_redemption_code_user').on(t.promoCodeId, t.userId),
        remainingChargesCheck: check(
            'ck_promo_redemption_remaining_charges',
            sql`${t.remainingCharges} IS NULL OR ${t.remainingCharges} >= 0`
        ),
        subscriptionOrUnlimitedCheck: check(
            'ck_promo_redemption_subscription_or_unlimited',
            sql`${t.subscriptionId} IS NOT NULL OR ${t.remainingCharges} IS NULL`
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
