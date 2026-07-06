/**
 * Posts list page - using generic entity list system
 */

import { createFileRoute } from '@tanstack/react-router';
import { PostsRoute } from '@/features/posts/config/posts.config';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = PostsRoute;
