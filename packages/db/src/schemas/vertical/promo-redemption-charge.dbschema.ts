import { pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { payments } from './payment.dbschema.ts';
import { promoRedemptions } from './promo.dbschema.ts';

/**
 * Per-charge promo ledger (HOS-2352): one row per payment that spent one charge
 * of a redemption, written by P1 in the same transaction as the decrement of
 * `promo_redemption.remaining_charges`. `charge_created_at` is the provider's
 * charge instant, so the reconciliation can count how many charges a redemption
 * had spent before any given charge. Each (redemption, payment) pair is unique.
 */
export const promoRedemptionCharges = pgTable(
    'promo_redemption_charge',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** redención */
        redemptionId: uuid('redemption_id')
            .notNull()
            .references(() => promoRedemptions.id, { onDelete: 'cascade' }),
        /** pago */
        paymentId: uuid('payment_id')
            .notNull()
            .references(() => payments.id, { onDelete: 'cascade' }),
        /** instante del cobro en el proveedor */
        chargeCreatedAt: timestamp('charge_created_at', { withTimezone: true }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        redemptionPaymentUnique: unique('uq_promo_redemption_charge_redemption_payment').on(
            t.redemptionId,
            t.paymentId
        )
    })
);

/** Insert shape for a promo ledger row. */
export type InsertPromoRedemptionCharge = typeof promoRedemptionCharges.$inferInsert;
/** Select shape for a promo ledger row. */
export type SelectPromoRedemptionCharge = typeof promoRedemptionCharges.$inferSelect;
