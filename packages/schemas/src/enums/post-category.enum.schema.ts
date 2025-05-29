import { PostCategoryEnum } from '@repo/types';
import { z } from 'zod';

export const PostCategoryEnumSchema = z.enum(
    Object.values(PostCategoryEnum) as [string, ...string[]],
    {
        errorMap: () => ({ message: 'zodError.enums.postCategory.invalid' })
    }
);
