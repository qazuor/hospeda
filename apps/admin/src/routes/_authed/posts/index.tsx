/**
 * Posts list page - using generic entity list system
 */
import { PostsPageComponent, PostsRoute } from '@/features/posts/config/posts.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [159549bf-a1f1-417d-9136-a0da1a87fb88]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = PostsRoute;
export default PostsPageComponent;
