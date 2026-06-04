/**
 * My Accommodations Page Route
 *
 * Host portfolio view — grid-only, powered by the generic createEntityListPage
 * framework. Inherits FilterBar, peek drawer, shared cells, pagination, and sort
 * from the entity-list system.
 *
 * Owner-scoping: enforced server-side by AccommodationService._executeAdminSearch
 * (SPEC-169 §5.2). A HOST actor holding ACCOMMODATION_VIEW_OWN has its ownerId
 * silently overwritten with actor.id on every request — no client-side filter needed.
 */

import { MeAccommodationsRoute } from '@/features/accommodations/config/me-accommodations.config';

// Re-export the generated route so TanStack Router picks it up via file-based routing.
export const Route = MeAccommodationsRoute;
