import { PostCategoryEnum } from '@repo/types';
import { z } from 'zod';

export const PostCategoryEnumSchema = z.nativeEnum(PostCategoryEnum, {
    error: () => ({ message: 'zodError.enums.postCategory.invalid' })
});
