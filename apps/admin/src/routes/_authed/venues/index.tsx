/**
 * Venue list page — admin directory of food and beverage listings.
 *
 * Uses the generic `createEntityListPage` system via the venue feature config.
 * The route and component are generated from `VenuesRoute` /
 * `VenuesPageComponent` in the `venue` feature config.
 */

import { createFileRoute } from '@tanstack/react-router';
import { VenuesPageComponent, VenuesRoute } from '@/features/venue/config/venue.config';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = VenuesRoute;
export { VenuesPageComponent as default };
