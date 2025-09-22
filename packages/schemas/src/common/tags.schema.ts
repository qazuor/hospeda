import { z } from 'zod';
import { TagSchema } from '../entities/tag/tag.schema.js';

/**
 * Tags Schema - Complete tags information
 * Can be used as a standalone schema when needed
 */
export const TagsSchema = z.object({
    tags: z.array(TagSchema).optional()
});
export type TagsType = z.infer<typeof TagsSchema>;

/**
 * Tags fields (using TagsSchema structure)
 */
export const TagsFields = {
    tags: z.array(TagSchema).optional()
} as const;
export type TagsFieldsType = typeof TagsFields;
