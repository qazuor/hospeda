/**
 * Accommodations list page - using generic entity list system
 */
import { AccommodationsRoute } from '@/features/accommodations/config/accommodations.config';
import { createFileRoute } from '@tanstack/react-router';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = AccommodationsRoute;
