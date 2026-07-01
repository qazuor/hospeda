import { z } from 'zod';
import { AccommodationIdSchema, PriceAlertIdSchema, UserIdSchema } from '../../common/id.schema.js';

/**
 * Core PriceAlert entity schema — a tourist's subscription to be notified
 * when an accommodation's price drops (SPEC-286 G-1).
 *
 * Maps 1-to-1 to the `tourist_price_alerts` table columns. Deliberately lean:
 * no audit ownership fields (`createdById`/`updatedById`/`deletedById`) — the
 * table has no such columns, only `user_id` as the owning actor. `deletedAt`
 * IS included: the table soft-deletes (project default for `BaseModel`) and
 * `BaseCrudService`'s list/get filtering relies on it being present on the
 * entity schema.
 */
export const PriceAlertSchema = z.object({
    /** Surrogate PK (UUID). */
    id: PriceAlertIdSchema,

    /** The tourist who owns this subscription. */
    userId: UserIdSchema,

    /** The accommodation being watched for price drops. */
    accommodationId: AccommodationIdSchema,

    /**
     * Price snapshot (integer centavos) taken at subscription time. Used as
     * the baseline for computing the percentage drop against the
     * accommodation's current price.
     */
    basePriceSnapshot: z
        .number({ message: 'zodError.priceAlert.basePriceSnapshot.required' })
        .int({ message: 'zodError.priceAlert.basePriceSnapshot.int' })
        .min(0, { message: 'zodError.priceAlert.basePriceSnapshot.min' }),

    /**
     * Minimum percentage drop (1-100) required to trigger this alert.
     *
     * `null` means "notify on any drop" — the evaluator falls back to the
     * platform-wide default threshold
     * (`HOSPEDA_ALERT_PRICE_DROP_THRESHOLD_PCT`) instead of a per-alert value.
     */
    targetPercentDrop: z
        .number({ message: 'zodError.priceAlert.targetPercentDrop.required' })
        .int({ message: 'zodError.priceAlert.targetPercentDrop.int' })
        .min(1, { message: 'zodError.priceAlert.targetPercentDrop.min' })
        .max(100, { message: 'zodError.priceAlert.targetPercentDrop.max' })
        .nullable(),

    /** Whether this subscription is currently active (soft on/off toggle). */
    isActive: z.boolean({ message: 'zodError.priceAlert.isActive.required' }),

    createdAt: z.coerce.date({ message: 'zodError.priceAlert.createdAt.required' }),
    updatedAt: z.coerce.date({ message: 'zodError.priceAlert.updatedAt.required' }),

    /** Soft-delete marker. `null` (or absent) while the alert is live. */
    deletedAt: z.coerce
        .date({ message: 'zodError.priceAlert.deletedAt.required' })
        .nullable()
        .optional()
});

/**
 * TypeScript type for a stored price alert, inferred from
 * {@link PriceAlertSchema}.
 */
export type PriceAlert = z.infer<typeof PriceAlertSchema>;
