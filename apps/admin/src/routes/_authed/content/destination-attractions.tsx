/**
 * Attractions list page - using generic entity list system
 */
import {
    AttractionsPageComponent,
    AttractionsRoute
} from '@/features/attractions/config/attractions.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [e6a5a7d5-3601-4ee7-8388-ed70788872f8]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = AttractionsRoute;
export { AttractionsPageComponent as default };
