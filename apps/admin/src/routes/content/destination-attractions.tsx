/**
 * Attractions list page - using generic entity list system
 */
import {
    AttractionsPageComponent,
    AttractionsRoute
} from '@/features/attractions/config/attractions.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [3d358ef7-6d7f-4bd2-9fc6-84200423686d]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = AttractionsRoute;
export { AttractionsPageComponent as default };
