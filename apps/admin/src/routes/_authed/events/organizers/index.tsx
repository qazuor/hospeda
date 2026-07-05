import { createFileRoute } from '@tanstack/react-router';
import { EventOrganizersRoute } from '@/features/event-organizers/config/event-organizers.config';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = EventOrganizersRoute;
