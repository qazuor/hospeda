/**
 * Points of interest list page - using generic entity list system
 */

import { createFileRoute } from '@tanstack/react-router';
import {
    PointsOfInterestPageComponent,
    PointsOfInterestRoute
} from '@/features/points-of-interest/config/points-of-interest.config';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = PointsOfInterestRoute;
export { PointsOfInterestPageComponent as default };
