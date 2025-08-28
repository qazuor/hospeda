import {
    EventLocationsPageComponent,
    EventLocationsRoute
} from '@/features/event-locations/config/event-locations.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [95d11be2-2e1f-4520-88c2-06d0c0f2053d]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = EventLocationsRoute;
export default EventLocationsPageComponent;
