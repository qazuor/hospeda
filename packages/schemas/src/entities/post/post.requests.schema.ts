import type { z } from 'zod';
import {
    CreatePostServiceSchema,
    PostFilterInputSchema,
    UpdatePostServiceSchema
} from './post.service.schema.js';

export const PostCreateSchema = CreatePostServiceSchema;
export type PostCreateRequest = z.infer<typeof PostCreateSchema>;

export const PostUpdateSchema = UpdatePostServiceSchema;
export type PostUpdateRequest = z.infer<typeof PostUpdateSchema>;

export const PostFilterSchema = PostFilterInputSchema;
export type PostFilterRequest = z.infer<typeof PostFilterSchema>;
