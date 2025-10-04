/**
 * Features list page - using generic entity list system
 */
import { FeaturesPageComponent, FeaturesRoute } from '@/features/features/config/features.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [b9c240f9-1c05-4fce-9df9-a784444f5220]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = FeaturesRoute;
export default FeaturesPageComponent;
