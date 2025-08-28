/**
 * Features list page - using generic entity list system
 */
import { FeaturesPageComponent, FeaturesRoute } from '@/features/features/config/features.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [e6934a6f-3b15-4137-a9b0-b8c5b54566bf]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = FeaturesRoute;
export default FeaturesPageComponent;
