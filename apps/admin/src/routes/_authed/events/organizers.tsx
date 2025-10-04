import {
    EventOrganizersPageComponent,
    EventOrganizersRoute
} from '@/features/event-organizers/config/event-organizers.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [2f7efed6-831f-489d-b525-f1b881cfe7d5]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = EventOrganizersRoute;
export default EventOrganizersPageComponent;
