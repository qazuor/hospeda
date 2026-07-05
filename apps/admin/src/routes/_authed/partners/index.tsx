import { createFileRoute } from '@tanstack/react-router';
import { PartnersRoute } from '@/features/partners/config/partners.config';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = PartnersRoute;
