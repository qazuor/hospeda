import { z } from 'zod';
import { TagColorEnum } from './tag-color.enum.js';

export const TagColorEnumSchema = z.nativeEnum(TagColorEnum, {
    error: () => ({ message: 'zodError.enums.tagColor.invalid' })
});
export type TagColorSchema = z.infer<typeof TagColorEnumSchema>;
