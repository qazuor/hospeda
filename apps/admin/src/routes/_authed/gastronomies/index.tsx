/**
 * Gastronomy list page — admin directory of food and beverage commerce listings.
 *
 * Uses the generic `createEntityListPage` system via the gastronomy feature config.
 * The route and component are generated from `GastronomiesRoute` /
 * `GastronomiesPageComponent` in the `gastronomy` feature config.
 */
import {
    GastronomiesPageComponent,
    GastronomiesRoute
} from '@/features/gastronomy/config/gastronomy.config';
import { createFileRoute } from '@tanstack/react-router';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = GastronomiesRoute;
export { GastronomiesPageComponent as default };
