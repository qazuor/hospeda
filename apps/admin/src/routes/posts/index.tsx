/**
 * Posts list page - using generic entity list system
 */
import { PostsPageComponent, PostsRoute } from '@/features/posts/config/posts.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [739ef823-33bc-4098-b7d7-52af9156dc7e]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = PostsRoute;
export default PostsPageComponent;
