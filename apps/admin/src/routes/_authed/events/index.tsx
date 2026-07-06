/**
 * Events list page - using generic entity list system
 */

import { createFileRoute } from '@tanstack/react-router';
import { EventsRoute } from '@/features/events/config/events.config';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = EventsRoute;
