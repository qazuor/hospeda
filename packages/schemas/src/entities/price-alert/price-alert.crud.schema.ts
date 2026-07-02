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

/**
 * Update input for a price-alert subscription.
 *
 * This schema exists ONLY to satisfy `BaseCrudService`'s hard abstract-member
 * contract (every concrete service must supply a `TUpdateSchema` /
 * `updateSchema`) — it is NOT wired to any route. The product design (see the
 * module doc comment above) is deliberately "no update input": a subscription's
 * threshold is changed by deleting and re-creating it, not by editing it in
 * place. `AlertSubscriptionService._canUpdate` always throws `FORBIDDEN`, so
 * `BaseCrudService.update()` is a hard no-op even if a caller reaches it by
 * mistake.
 *
 * The single field kept here (`targetPercentDrop`) is the only value that
 * could ever legitimately change on an existing row.
 */
export const PriceAlertUpdateInputSchema = z.object({
    targetPercentDrop: z
        .number({ message: 'zodError.priceAlert.targetPercentDrop.required' })
        .int({ message: 'zodError.priceAlert.targetPercentDrop.int' })
        .min(1, { message: 'zodError.priceAlert.targetPercentDrop.min' })
        .max(100, { message: 'zodError.priceAlert.targetPercentDrop.max' })
        .nullable()
        .optional()
});

/**
 * TypeScript type for the update-alert input, inferred from
 * {@link PriceAlertUpdateInputSchema}.
 */
export type PriceAlertUpdateInput = z.infer<typeof PriceAlertUpdateInputSchema>;
