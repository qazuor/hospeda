/**
 * Users list page - using generic entity list system
 */
import { UsersPageComponent, UsersRoute } from '@/features/users/config/users.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = UsersRoute;
export default UsersPageComponent;
