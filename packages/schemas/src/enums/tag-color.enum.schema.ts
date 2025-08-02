import { TagColorEnum } from '@repo/types';
import { z } from 'zod';

export const TagColorEnumSchema = z.nativeEnum(TagColorEnum, {
    error: () => ({ message: 'zodError.enums.tagColor.invalid' })
});
