/**
 * Lightweight relation-selector lookup schemas (SPEC-169 §5.5 / decision D4).
 *
 * The `/api/v1/admin/<entity>/options` endpoints exist so that admin relation
 * selectors (owner, destination, accommodation, etc.) can be populated WITHOUT
 * requiring a broad `_VIEW_ALL` / `_READ_ALL` grant. They are gated by
 * `ACCESS_PANEL_ADMIN` only and expose strictly public-grade identity fields.
 *
 * Payload contract (D4):
 * - Every entity returns `{ id, label, slug }` (label = display name).
 * - Accommodation additionally returns `type` and `destination` (OQ3 / D4).
 *
 * Results are DRAFT-inclusive (no publication-state filter) so relations can
 * target unpublished entities.
 */
import { z } from 'zod';

/**
 * Query parameters accepted by every `/options` lookup endpoint.
 *
 * - `q`: optional case-insensitive search term matched against the display name.
 * - `limit`: optional result cap, coerced from the query string, 1-100, default 20.
 */
export const EntityOptionsQuerySchema = z.object({
    q: z.string().trim().min(1).optional().describe('Optional search term (matched on the label)'),
    limit: z.coerce
        .number()
        .int()
        .min(1, { message: 'zodError.common.options.limit.min' })
        .max(100, { message: 'zodError.common.options.limit.max' })
        .default(20)
        .describe('Maximum number of options to return (1-100, default 20)')
});

/**
 * Type inferred from {@link EntityOptionsQuerySchema}.
 */
export type EntityOptionsQuery = z.infer<typeof EntityOptionsQuerySchema>;

/**
 * Base option item returned by every `/options` endpoint.
 *
 * Intentionally minimal: identity fields only, no admin/private/pricing/contact data.
 */
export const EntityOptionsItemSchema = z.object({
    /** Entity id (UUID). */
    id: z.string().describe('Entity id'),
    /** Display name shown in the selector. */
    label: z.string().describe('Display name'),
    /** URL-friendly slug. */
    slug: z.string().describe('Entity slug')
});

/**
 * Type inferred from {@link EntityOptionsItemSchema}.
 */
export type EntityOptionsItem = z.infer<typeof EntityOptionsItemSchema>;

/**
 * Wrapper schema for an array of option items (the route response payload).
 */
export const EntityOptionsListSchema = z.object({
    items: z.array(EntityOptionsItemSchema).describe('Matching options')
});

/**
 * Type inferred from {@link EntityOptionsListSchema}.
 */
export type EntityOptionsList = z.infer<typeof EntityOptionsListSchema>;
