import { PartnersRoute } from '@/features/partners/config/partners.config';
import { createFileRoute } from '@tanstack/react-router';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = PartnersRoute;
