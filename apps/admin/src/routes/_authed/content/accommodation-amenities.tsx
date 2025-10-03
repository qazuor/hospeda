/**
 * Amenities list page - using generic entity list system
 */
import {
    AmenitiesPageComponent,
    AmenitiesRoute
} from '@/features/amenities/config/amenities.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [970cf8ec-d48b-4682-ae51-3279deab5429]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = AmenitiesRoute;
export default AmenitiesPageComponent;
