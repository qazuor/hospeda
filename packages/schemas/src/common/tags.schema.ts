import { z } from 'zod';
import { TagSchema } from '../entities/tag/tag.schema.js';

/**
 * Tags Schema - Complete tags information
 * Can be used as a standalone schema when needed
 */
export const TagsSchema = z.object({
    tags: z.array(TagSchema).optional()
});

/**
 * Type exports for tags schemas
 */
export type Tags = z.infer<typeof TagsSchema>;
