/**
 * Features list page - using generic entity list system
 */
import { FeaturesPageComponent, FeaturesRoute } from '@/features/features/config/features.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [defe127d-bc50-449e-b76e-387c19778c11]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = FeaturesRoute;
export default FeaturesPageComponent;
