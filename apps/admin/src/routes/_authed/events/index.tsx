/**
 * Events list page - using generic entity list system
 */
import { EventsRoute } from '@/features/events/config/events.config';
import { createFileRoute } from '@tanstack/react-router';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = EventsRoute;
