/**
 * Attractions list page - using generic entity list system
 */
import {
    AttractionsPageComponent,
    AttractionsRoute
} from '@/features/attractions/config/attractions.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [f2535635-5073-4a8b-9e51-2f330a7e232f]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = AttractionsRoute;
export { AttractionsPageComponent as default };
