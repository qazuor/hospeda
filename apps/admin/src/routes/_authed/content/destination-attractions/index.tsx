/**
 * Attractions list page - using generic entity list system
 */

import { createFileRoute } from '@tanstack/react-router';
import {
    AttractionsPageComponent,
    AttractionsRoute
} from '@/features/attractions/config/attractions.config';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = AttractionsRoute;
export { AttractionsPageComponent as default };
