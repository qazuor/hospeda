/**
 * Admin Tag Schemas
 *
 * Base fields available from TagSchema:
 * - id, name, slug, color, icon, notes
 * - lifecycleState
 * - Audit fields (createdAt, updatedAt, etc.)
 */

import { TagSchema } from '@repo/schemas';
import type { z } from 'zod';

/**
 * Admin Tag List Item Schema
 */
export const TagListItemSchema = TagSchema.pick({
    id: true,
    name: true,
    slug: true,
    color: true,
    icon: true,
    notes: true,
    lifecycleState: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Type for tag list items
 */
export type Tag = z.infer<typeof TagListItemSchema>;
