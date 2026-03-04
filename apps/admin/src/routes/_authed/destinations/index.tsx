/**
 * Destinations list page - refactored using generic entity list system
 */
import { DestinationsRoute } from '@/features/destinations/config/destinations.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = DestinationsRoute;
