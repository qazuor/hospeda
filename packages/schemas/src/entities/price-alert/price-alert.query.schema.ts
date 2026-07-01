import { z } from 'zod';
import { PaginationSchema } from '../../common/pagination.schema.js';
import { PriceAlertSchema } from './price-alert.schema.js';

/**
 * PriceAlert query/response schemas (SPEC-286 G-1).
 */

/**
 * Input for listing the current actor's price-alert subscriptions.
 *
 * Reuses the shared `page`/`pageSize` {@link PaginationSchema} — there is no
 * sorting or free-text search for this simple, per-user list (YAGNI).
 *
 * @example
 * ```ts
 * ListPriceAlertsInputSchema.parse({}); // { page: 1, pageSize: 10 }
 * ```
 */
export const ListPriceAlertsInputSchema = PaginationSchema;

/**
 * TypeScript type for the list input, inferred from
 * {@link ListPriceAlertsInputSchema}.
 */
export type ListPriceAlertsInput = z.infer<typeof ListPriceAlertsInputSchema>;

/**
 * API response shape for a single price alert.
 *
 * Extends the core entity with `accommodationName`, a denormalized display
 * field the service layer populates from the current accommodation record so
 * callers (web list/detail pages) don't need a second round-trip to render
 * the alert — mirrors the `accommodationName` denormalization pattern used on
 * conversation response schemas (`conversation.http.schema.ts`).
 */
export const PriceAlertResponseSchema = PriceAlertSchema.extend({
    accommodationName: z.string({ message: 'zodError.priceAlert.accommodationName.required' })
});

/**
 * TypeScript type for the API response shape, inferred from
 * {@link PriceAlertResponseSchema}.
 */
export type PriceAlertResponse = z.infer<typeof PriceAlertResponseSchema>;
