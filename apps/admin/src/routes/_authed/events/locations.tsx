import {
    EventLocationsPageComponent,
    EventLocationsRoute
} from '@/features/event-locations/config/event-locations.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = EventLocationsRoute;
export default EventLocationsPageComponent;
