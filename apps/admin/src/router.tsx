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
            <div
                className="h-full bg-primary"
                style={{
                    animation: 'router-pending-bar 1.5s ease-in-out infinite'
                }}
            />
        </div>
    );
}

// Create a new router instance
export const createRouter = () => {
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

// Register the router instance for type safety
declare module '@tanstack/react-router' {
    interface Register {
        router: ReturnType<typeof createRouter>;
    }
}
