import { z } from 'zod';
import { TagTypeEnum } from './tag-type.enum.js';

/**
 * Zod schema for validating {@link TagTypeEnum} values at runtime.
 *
 * Accepts only the string literals `'INTERNAL'`, `'SYSTEM'`, or `'USER'`.
 *
 * @example
 * ```ts
 * TagTypeSchema.parse('INTERNAL')  // => 'INTERNAL'
 * TagTypeSchema.parse('INVALID')   // throws ZodError
 * ```
 */
export const TagTypeSchema = z.nativeEnum(TagTypeEnum, {
    error: () => ({ message: 'zodError.enums.tagType.invalid' })
});

export type TagType = z.infer<typeof TagTypeSchema>;
