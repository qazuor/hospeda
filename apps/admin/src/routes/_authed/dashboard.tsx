/**
 * Dashboard route configuration
 *
 * Critical route configuration loaded immediately.
 * The heavy UI component is lazy loaded from dashboard.lazy.tsx
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/dashboard')({
    // Add any loaders or search param validation here
    // The component is loaded from dashboard.lazy.tsx
});
