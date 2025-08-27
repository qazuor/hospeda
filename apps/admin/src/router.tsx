import { createRouter as createTanstackRouter } from '@tanstack/react-router';

// Import the generated route tree
import { routeTree } from './routeTree.gen';

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

// Create a new router instance
export const createRouter = () => {
    const context: RouterContext = {};

    return createTanstackRouter({
        routeTree,
        context,
        scrollRestoration: true,
        defaultPreloadStaleTime: 0,
        defaultPreload: 'intent', // Prefetch on hover/focus
        defaultPreloadDelay: 100 // Small delay to avoid excessive prefetching
    });
};

// Register the router instance for type safety
declare module '@tanstack/react-router' {
    interface Register {
        router: ReturnType<typeof createRouter>;
    }
}
