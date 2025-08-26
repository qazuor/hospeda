/**
 * Amenities list page - using generic entity list system
 */
import {
    AmenitiesPageComponent,
    AmenitiesRoute
} from '@/features/amenities/config/amenities.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [34ea2535-44b8-4266-9f31-fb20d246f2aa]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = AmenitiesRoute;
export default AmenitiesPageComponent;
