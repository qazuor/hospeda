/**
 * Destinations list page - refactored using generic entity list system
 */
import {
    DestinationsPageComponent,
    DestinationsRoute
} from '@/features/destinations/config/destinations.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [f7bc10a4-3c0e-46f7-8e29-5cee61afd9a6]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = DestinationsRoute;
export default DestinationsPageComponent;
