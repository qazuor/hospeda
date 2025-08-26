/**
 * Events list page - using generic entity list system
 */
import { EventsPageComponent, EventsRoute } from '@/features/events/config/events.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [a3ab8d1b-7234-4c01-8e56-0811af4c8fb8]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = EventsRoute;
export default EventsPageComponent;
