import { PostCategoryEnum } from '@repo/types';
import { z } from 'zod';

export const PostCategoryEnumSchema = z.nativeEnum(PostCategoryEnum, {
    errorMap: () => ({ message: 'zodError.enums.postCategory.invalid' })
});
