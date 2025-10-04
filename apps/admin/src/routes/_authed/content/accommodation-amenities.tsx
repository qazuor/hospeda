/**
 * Amenities list page - using generic entity list system
 */
import {
    AmenitiesPageComponent,
    AmenitiesRoute
} from '@/features/amenities/config/amenities.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [928e7372-2a89-41f2-9692-8d512b70b780]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = AmenitiesRoute;
export default AmenitiesPageComponent;
