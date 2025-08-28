import { SponsorsPageComponent, SponsorsRoute } from '@/features/sponsors/config/sponsors.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [fdd258da-ac0b-41e0-ad19-261eb43f7c52]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = SponsorsRoute;
export default SponsorsPageComponent;
