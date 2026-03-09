/**
 * Tags list page - using generic entity list system
 */
import { TagsRoute } from '@/features/tags/config/tags.config';
import { createFileRoute } from '@tanstack/react-router';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = TagsRoute;
