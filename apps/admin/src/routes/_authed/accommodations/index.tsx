/**
 * Accommodations list page - using generic entity list system
 */
import {
    AccommodationsPageComponent,
    AccommodationsRoute
} from '@/features/accommodations/config/accommodations.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [09ce144b-12fc-4a8c-a17b-20b7e315d901]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = AccommodationsRoute;
export default AccommodationsPageComponent;
