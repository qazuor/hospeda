/**
 * Accommodations list page - using generic entity list system
 */
import {
    AccommodationsPageComponent,
    AccommodationsRoute
} from '@/features/accommodations/config/accommodations.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = AccommodationsRoute;
export default AccommodationsPageComponent;
