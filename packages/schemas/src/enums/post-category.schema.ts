import { z } from 'zod';
import { PostCategoryEnum } from './post-category.enum.js';

export const PostCategoryEnumSchema = z.nativeEnum(PostCategoryEnum, {
    error: () => ({ message: 'zodError.enums.postCategory.invalid' })
});
