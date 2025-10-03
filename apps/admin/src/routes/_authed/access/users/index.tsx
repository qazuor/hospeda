/**
 * Users list page - using generic entity list system
 */
import { UsersPageComponent, UsersRoute } from '@/features/users/config/users.config';
import { createFileRoute } from '@tanstack/react-router';

// HACK [e5541c1b-24eb-4c77-8768-c17163c97b5a]: Prevent TypeScript error for TanStack Router auto-generated import
createFileRoute;

export const Route = UsersRoute;
export default UsersPageComponent;
