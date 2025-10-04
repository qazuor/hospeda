import {
    EventLocationsPageComponent,
    EventLocationsRoute
} from '@/features/event-locations/config/event-locations.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [042ef506-f452-4773-abf5-f29cf778e898]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = EventLocationsRoute;
export default EventLocationsPageComponent;
