/**
 * Posts list page - using generic entity list system
 */
import { PostsPageComponent, PostsRoute } from '@/features/posts/config/posts.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [33ac7f25-a6cc-4311-bdbd-e2ac64809dca]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = PostsRoute;
export default PostsPageComponent;
