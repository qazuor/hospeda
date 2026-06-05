import { z } from 'zod';

/**
 * EntityView query schemas (SPEC-159 §5).
 *
 * Two purpose-built schemas: an enum for the rolling-window duration and a
 * query-params object for the stats endpoint. Both use `z.coerce` where the
 * value arrives as an HTTP query string.
 */

// ============================================================================
// WINDOW ENUM
// ============================================================================

/**
 * Accepted rolling-window durations for view-count aggregation.
 *
 * - `'7d'`  — last 7 calendar days (rolling).
 * - `'30d'` — last 30 calendar days (rolling, default).
 *
 * Any other string (e.g. `'90d'`) is rejected with a descriptive error.
 *
 * @example
 * ```ts
 * EntityViewWindowSchema.parse('7d');   // ok
 * EntityViewWindowSchema.parse('30d');  // ok
 * EntityViewWindowSchema.parse('90d');  // throws ZodError
 * ```
 */
export const EntityViewWindowSchema = z.enum(['7d', '30d'], {
    message: 'zodError.entityView.window.invalid'
});

/**
 * TypeScript union type for the view-count window, inferred from
 * {@link EntityViewWindowSchema}.
 */
export type EntityViewWindow = z.infer<typeof EntityViewWindowSchema>;

// ============================================================================
// STATS QUERY PARAMS
// ============================================================================

/**
 * Default rolling window when the caller omits the `window` query param.
 */
export const ENTITY_VIEW_DEFAULT_WINDOW = '30d' as const satisfies EntityViewWindow;

/**
 * Query-params schema for `GET /…/:id/view-stats`.
 *
 * `window` defaults to `'30d'` when absent, consistent with how other query
 * schemas in this package define optional params with defaults (e.g.
 * `PublicCommentThreadQuerySchema.page`).
 *
 * @example
 * ```ts
 * // No window param → defaults to '30d'
 * EntityViewQuerySchema.parse({});
 * // → { window: '30d' }
 *
 * EntityViewQuerySchema.parse({ window: '7d' });
 * // → { window: '7d' }
 * ```
 */
export const EntityViewQuerySchema = z.object({
    window: EntityViewWindowSchema.default(ENTITY_VIEW_DEFAULT_WINDOW)
});

/**
 * TypeScript type for the view-stats query params, inferred from
 * {@link EntityViewQuerySchema}.
 */
export type EntityViewQuery = z.infer<typeof EntityViewQuerySchema>;
