/**
 * Amenities list page - using generic entity list system
 */
import { AmenitiesRoute } from '@/features/amenities/config/amenities.config';
import { createFileRoute } from '@tanstack/react-router';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = AmenitiesRoute;
