/**
 * @module entities/newsletter/newsletter-delivery.http.schema
 *
 * HTTP response schemas for newsletter delivery endpoints (SPEC-101).
 */

import { z } from 'zod';

// ============================================================================
// NewsletterDeliveryFailedItemSchema
// ============================================================================

/**
 * Response item shape for `GET /api/v1/admin/newsletter/campaigns/:id/errors`.
 *
 * Represents a single FAILED delivery row shown in the "Ver errores" admin dialog.
 * The email address is masked at the SERVICE layer (e.g. `j***@example.com`) before
 * this schema is applied — masking is NOT enforced here so that the service can
 * apply its own masking strategy without fighting the schema.
 *
 * `retryCount` reflects the total number of BullMQ retry attempts before the
 * delivery reached FAILED status.
 *
 * @example
 * ```ts
 * const item = NewsletterDeliveryFailedItemSchema.parse({
 *   id: 'uuid...',
 *   email: 'j***@example.com',
 *   errorMessage: 'SMTP timeout',
 *   retryCount: 3
 * });
 * ```
 */
export const NewsletterDeliveryFailedItemSchema = z.object({
    /** UUID of the delivery row. */
    id: z.string().uuid(),

    /**
     * Masked subscriber email address.
     * The service layer applies the masking strategy; this field accepts any
     * string to avoid constraining the mask format.
     */
    email: z.string(),

    /** Most recent error message from the dispatch worker. */
    errorMessage: z.string().nullable(),

    /** Total number of BullMQ retry attempts for this delivery. */
    retryCount: z.number().int().min(0)
});

/** TypeScript type inferred from {@link NewsletterDeliveryFailedItemSchema}. */
export type NewsletterDeliveryFailedItem = z.infer<typeof NewsletterDeliveryFailedItemSchema>;
