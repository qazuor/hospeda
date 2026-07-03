import { createRouter as createTanstackRouter } from '@tanstack/react-router';

// Import the generated route tree
import { routeTree } from './routeTree.gen';

// Register global CSP middleware (side-effect import - must execute before server functions)
import './start';

/**
 * Router context interface
 * Provides shared services and state to all routes
 */
export interface RouterContext {
    readonly auth?: {
        readonly userId: string;
        readonly permissions: readonly string[];
    };
}

/**
 * Loading bar shown during route transitions.
 * Only appears after defaultPendingMs delay to avoid flash on fast navigations.
 * The @keyframes animation is defined in styles.css to avoid inline <style> CSP violations.
 */
function RouterPendingComponent() {
    return (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5">
            <div className="h-full animate-router-pending bg-primary" />
        </div>
    );
}

// Create a new router instance.
//
// HOS-33: this factory MUST be exported as `getRouter` (not `createRouter`).
// TanStack Start >= 1.132.0 auto-discovers this file as the "router entry"
// by convention and imports the export by that exact name — verified via a
// real `vite build` run, which fails with `[MISSING_EXPORT] "getRouter" is
// not exported by "src/router.tsx"` when this export is named anything
// else. The `Register.router` type augmentation is also now AUTO-GENERATED
// by the route-tree generator itself (see the footer of
// `routeTree.gen.ts`: `import type { getRouter } from './router.tsx'` /
// `declare module '@tanstack/react-start' { interface Register { router:
// Awaited<ReturnType<typeof getRouter>> } }`), so the manual `declare
// module '@tanstack/react-router'` block that used to live here is no
// longer needed and has been removed.
export const getRouter = () => {
    const context: RouterContext = {};

    return createTanstackRouter({
        routeTree,
        context,
        scrollRestoration: true,
        defaultPreloadStaleTime: 0,
        defaultPreload: 'intent', // Prefetch on hover/focus
        defaultPreloadDelay: 100, // Small delay to avoid excessive prefetching
        defaultPendingComponent: RouterPendingComponent,
        defaultPendingMs: 200 // Only show if navigation takes > 200ms
    });
};
