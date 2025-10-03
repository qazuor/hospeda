import {
    EventLocationsPageComponent,
    EventLocationsRoute
} from '@/features/event-locations/config/event-locations.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [97dbb36b-671a-4d6f-abbd-6b681f12cb6c]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = EventLocationsRoute;
export default EventLocationsPageComponent;
