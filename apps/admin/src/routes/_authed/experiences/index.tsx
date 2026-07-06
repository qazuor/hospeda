/**
 * Experiences list page — admin directory of tourism and activity commerce listings.
 *
 * Uses the generic `createEntityListPage` system via the experience feature config.
 * The route and component are generated from `ExperiencesRoute` /
 * `ExperiencesPageComponent` in the `experience` feature config (SPEC-240 T-028).
 */

import { createFileRoute } from '@tanstack/react-router';
import {
    ExperiencesPageComponent,
    ExperiencesRoute
} from '@/features/experience/config/experience.config';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = ExperiencesRoute;
export { ExperiencesPageComponent as default };
