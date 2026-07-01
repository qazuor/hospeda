import { z } from 'zod';
import { AccommodationIdSchema, PriceAlertIdSchema } from '../../common/id.schema.js';

/**
 * PriceAlert CRUD input schemas (SPEC-286 G-1).
 *
 * There is no update input — a subscription's threshold is changed by
 * deleting and re-creating it, keeping the API surface minimal (YAGNI).
 */

/**
 * Input for subscribing to price-drop alerts on an accommodation.
 *
 * `userId` is intentionally omitted — the route handler injects it from the
 * authenticated actor's session, so a client can never subscribe another
 * user to an alert.
 *
 * @example
 * ```ts
 * const input: CreatePriceAlertInput = {
 *   accommodationId: '550e8400-e29b-41d4-a716-446655440000',
 *   targetPercentDrop: 10,
 * };
 * ```
 */
export const CreatePriceAlertInputSchema = z.object({
    accommodationId: AccommodationIdSchema,

    /**
     * Optional drop threshold (1-100). Omitted means "any drop" — persisted
     * as `null` on the entity (see {@link PriceAlertSchema.targetPercentDrop}
     * in `price-alert.schema.ts`).
     */
    targetPercentDrop: z
        .number({ message: 'zodError.priceAlert.targetPercentDrop.required' })
        .int({ message: 'zodError.priceAlert.targetPercentDrop.int' })
        .min(1, { message: 'zodError.priceAlert.targetPercentDrop.min' })
        .max(100, { message: 'zodError.priceAlert.targetPercentDrop.max' })
        .optional()
});

/**
 * TypeScript type for the create-alert input, inferred from
 * {@link CreatePriceAlertInputSchema}.
 */
export type CreatePriceAlertInput = z.infer<typeof CreatePriceAlertInputSchema>;

/**
 * Input for cancelling (soft-deleting) a price-alert subscription.
 *
 * Ownership is enforced by the service layer (`actor.id === alert.userId`),
 * not by this schema.
 */
export const DeletePriceAlertInputSchema = z.object({
    alertId: PriceAlertIdSchema
});

/**
 * TypeScript type for the delete-alert input, inferred from
 * {@link DeletePriceAlertInputSchema}.
 */
export type DeletePriceAlertInput = z.infer<typeof DeletePriceAlertInputSchema>;
