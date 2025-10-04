/**
 * Events list page - using generic entity list system
 */
import { EventsPageComponent, EventsRoute } from '@/features/events/config/events.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [fbb95cd5-286b-4c4a-8546-aa05d58a7429]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = EventsRoute;
export default EventsPageComponent;
