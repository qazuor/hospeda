import { PostListItemSchema, type PostListItem } from '@repo/schemas';

// Re-export the official schema from @repo/schemas for consistency
export { PostListItemSchema };
export type Post = PostListItem;
