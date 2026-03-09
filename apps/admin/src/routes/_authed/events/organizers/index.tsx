import { EventOrganizersRoute } from '@/features/event-organizers/config/event-organizers.config';
import { createFileRoute } from '@tanstack/react-router';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = EventOrganizersRoute;
