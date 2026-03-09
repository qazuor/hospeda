/**
 * Destinations list page - refactored using generic entity list system
 */
import { DestinationsRoute } from '@/features/destinations/config/destinations.config';
import { createFileRoute } from '@tanstack/react-router';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = DestinationsRoute;
