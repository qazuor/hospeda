import { EventLocationsRoute } from '@/features/event-locations/config/event-locations.config';
import { createFileRoute } from '@tanstack/react-router';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = EventLocationsRoute;
