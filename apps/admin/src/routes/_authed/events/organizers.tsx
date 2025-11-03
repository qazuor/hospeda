import {
    EventOrganizersPageComponent,
    EventOrganizersRoute
} from '@/features/event-organizers/config/event-organizers.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = EventOrganizersRoute;
export default EventOrganizersPageComponent;
