import { SponsorsPageComponent, SponsorsRoute } from '@/features/sponsors/config/sponsors.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [805313ba-103b-4114-8664-21958d36caf9]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = SponsorsRoute;
export default SponsorsPageComponent;
