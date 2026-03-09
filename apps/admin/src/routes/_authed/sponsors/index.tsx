import { SponsorsRoute } from '@/features/sponsors/config/sponsors.config';
import { createFileRoute } from '@tanstack/react-router';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = SponsorsRoute;
