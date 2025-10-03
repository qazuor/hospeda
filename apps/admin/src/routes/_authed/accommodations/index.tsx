/**
 * Accommodations list page - using generic entity list system
 */
import {
    AccommodationsPageComponent,
    AccommodationsRoute
} from '@/features/accommodations/config/accommodations.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [761005c9-4b1e-44f8-bf67-6093ec391abd]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = AccommodationsRoute;
export default AccommodationsPageComponent;
