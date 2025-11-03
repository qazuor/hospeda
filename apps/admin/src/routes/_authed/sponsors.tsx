import { SponsorsPageComponent, SponsorsRoute } from '@/features/sponsors/config/sponsors.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = SponsorsRoute;
export default SponsorsPageComponent;
