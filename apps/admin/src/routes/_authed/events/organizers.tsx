import {
    EventOrganizersPageComponent,
    EventOrganizersRoute
} from '@/features/event-organizers/config/event-organizers.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [c853b756-6f8f-4529-a6f5-188abee4ba53]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = EventOrganizersRoute;
export default EventOrganizersPageComponent;
