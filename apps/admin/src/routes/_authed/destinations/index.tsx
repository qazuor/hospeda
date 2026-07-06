/**
 * Destinations list page - refactored using generic entity list system
 */

import { createFileRoute } from '@tanstack/react-router';
import { DestinationsRoute } from '@/features/destinations/config/destinations.config';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = DestinationsRoute;
