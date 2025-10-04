import { SponsorsPageComponent, SponsorsRoute } from '@/features/sponsors/config/sponsors.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [6b6dbcbe-9c2b-404e-a53c-39f93137de02]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = SponsorsRoute;
export default SponsorsPageComponent;
