/**
 * Attractions list page - using generic entity list system
 */
import {
    AttractionsPageComponent,
    AttractionsRoute
} from '@/features/attractions/config/attractions.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = AttractionsRoute;
export { AttractionsPageComponent as default };
