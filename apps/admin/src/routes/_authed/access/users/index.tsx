/**
 * Users list page - using generic entity list system
 */
import { UsersRoute } from '@/features/users/config/users.config';
import { createFileRoute } from '@tanstack/react-router';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = UsersRoute;
