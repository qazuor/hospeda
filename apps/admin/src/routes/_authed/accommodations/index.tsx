/**
 * Accommodations list page - using generic entity list system
 */
import {
    AccommodationsPageComponent,
    AccommodationsRoute
} from '@/features/accommodations/config/accommodations.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [398f8071-59d9-4f13-b1e9-9e3c30f24492]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = AccommodationsRoute;
export default AccommodationsPageComponent;
