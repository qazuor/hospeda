import { HostTradeSchema } from '@repo/schemas';
import type { z } from 'zod';

/**
 * Admin HostTrade list item schema — mirrors the full entity shape
 * returned by `GET /api/v1/admin/host-trades`.
 */
export const HostTradeListItemSchema = HostTradeSchema;

/**
 * TypeScript type for an admin host-trade list row.
 */
export type HostTradeListItem = z.infer<typeof HostTradeListItemSchema>;
