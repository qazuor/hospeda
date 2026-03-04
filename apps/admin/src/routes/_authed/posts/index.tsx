/**
 * Posts list page - using generic entity list system
 */
import { PostsRoute } from '@/features/posts/config/posts.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = PostsRoute;
