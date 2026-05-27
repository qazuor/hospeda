import { z } from 'zod';
import { ModerationStatusEnum } from '../enums/index.js';
import { ModerationStatusEnumSchema } from '../enums/index.js';

/**
 * Base moderation fields
 */
export const BaseModerationFields = {
    moderationState: ModerationStatusEnumSchema.default(ModerationStatusEnum.PENDING)
} as const;

/**
 * Moderation Schema - Complete moderation information
 * Can be used as a standalone schema when needed
 */
export const ModerationSchema = z.object({
    ...BaseModerationFields
});
export type Moderation = z.infer<typeof ModerationSchema>;

/**
 * Response schema for `GET /api/v1/admin/moderation/pending-count`.
 *
 * Returns the count of content items in PENDING moderation state across
 * the four main content entities: accommodations, destinations, posts, and events.
 *
 * - `byEntity`: per-entity breakdown of PENDING items.
 * - `total`: sum of all four entity counts.
 */
export const ModerationPendingCountSchema = z.object({
    total: z.number().int().min(0),
    byEntity: z.object({
        accommodations: z.number().int().min(0),
        destinations: z.number().int().min(0),
        posts: z.number().int().min(0),
        events: z.number().int().min(0)
    })
});
export type ModerationPendingCount = z.infer<typeof ModerationPendingCountSchema>;
