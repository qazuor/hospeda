/**
 * Amenities list page - using generic entity list system
 */
import { AmenitiesRoute } from '@/features/amenities/config/amenities.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = AmenitiesRoute;
