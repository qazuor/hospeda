/**
 * Features list page - using generic entity list system
 */

import { createFileRoute } from '@tanstack/react-router';
import { FeaturesRoute } from '@/features/features/config/features.config';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = FeaturesRoute;
