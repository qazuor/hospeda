/**
 * Features list page - using generic entity list system
 */
import { FeaturesRoute } from '@/features/features/config/features.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = FeaturesRoute;
