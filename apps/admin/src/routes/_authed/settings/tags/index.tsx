/**
 * Tags list page - using generic entity list system
 */
import { TagsPageComponent, TagsRoute } from '@/features/tags/config/tags.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = TagsRoute;
export default TagsPageComponent;
