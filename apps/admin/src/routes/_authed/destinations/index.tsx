/**
 * Destinations list page - refactored using generic entity list system
 */
import {
    DestinationsPageComponent,
    DestinationsRoute
} from '@/features/destinations/config/destinations.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [0247d1ed-0a93-48cb-bd99-fdd4cfa8875e]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = DestinationsRoute;
export default DestinationsPageComponent;
