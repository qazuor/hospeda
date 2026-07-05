import { createFileRoute } from '@tanstack/react-router';
import { EventLocationsRoute } from '@/features/event-locations/config/event-locations.config';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = EventLocationsRoute;
