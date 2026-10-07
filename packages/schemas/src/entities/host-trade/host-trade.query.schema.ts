import { z } from 'zod';
import { BaseSearchSchema } from '../../common/pagination.schema.js';
import { HostTradeCategoryEnumSchema } from '../../enums/host-trade-category.schema.js';

/**
 * HostTradeQuerySchema — public/host query filters for the host-trades list endpoint.
 *
 * Extends `BaseSearchSchema` (which provides `page`, `pageSize`, `sortBy`,
 * `sortOrder`, `sorts`, `featuredFirst`, and `q`) with entity-specific filters.
 *
 * @example
 * ```ts
 * const params = HostTradeQuerySchema.parse({
 *   destinationId: '550e8400-e29b-41d4-a716-446655440000',
 *   category: 'PLOMERIA',
 *   page: 1,
 *   pageSize: 20
 * });
 * ```
 */
export const HostTradeQuerySchema = BaseSearchSchema.extend({
    /** Filter by destination (required in most host-facing UIs) */
    destinationId: z.string().uuid().optional(),

    /** Filter by service category */
    category: HostTradeCategoryEnumSchema.optional(),

    /** Filter to show only 24h-available providers */
    is24h: z.boolean().optional()
});

/**
 * Inferred TypeScript type for HostTrade query parameters.
 */
export type HostTradeQuery = z.infer<typeof HostTradeQuerySchema>;
