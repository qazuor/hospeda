/**
 * Users list page - using generic entity list system
 */
import { UsersPageComponent, UsersRoute } from '@/features/users/config/users.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [1c14b5d8-efff-4dca-878c-a4dd62686182]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = UsersRoute;
export default UsersPageComponent;
