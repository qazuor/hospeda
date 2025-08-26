import {
    EventOrganizersPageComponent,
    EventOrganizersRoute
} from '@/features/event-organizers/config/event-organizers.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [e7b35dda-0f2b-4e06-9c06-534f1bd9e855]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = EventOrganizersRoute;
export default EventOrganizersPageComponent;
