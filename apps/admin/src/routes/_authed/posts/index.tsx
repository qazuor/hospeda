/**
 * Posts list page - using generic entity list system
 */
import { PostsRoute } from '@/features/posts/config/posts.config';
import { createFileRoute } from '@tanstack/react-router';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = PostsRoute;
