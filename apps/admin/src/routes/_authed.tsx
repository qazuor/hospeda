import { AppLayout } from '@/components/layout/AppLayout';
import { getAuth } from '@clerk/tanstack-react-start/server';
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getWebRequest } from '@tanstack/react-start/server';

/**
 * Server function to check authentication
 * This runs on the server before the route loads
 */
const fetchAuthState = createServerFn({ method: 'GET' }).handler(async () => {
    const request = getWebRequest();
    if (!request) {
        throw new Error('No request found');
    }

    const { userId } = await getAuth(request);

    return {
        userId,
        isAuthenticated: !!userId
    };
});

/**
 * Protected Layout Route
 * All routes under this layout require authentication
 * Automatically applies AppLayout to all child routes
 */
export const Route = createFileRoute('/_authed')({
    beforeLoad: async () => {
        const authState = await fetchAuthState();

        // If not authenticated, redirect to signin
        if (!authState.isAuthenticated) {
            throw redirect({
                to: '/auth/signin',
                search: {
                    redirect: typeof window !== 'undefined' ? window.location.pathname : '/'
                }
            });
        }

        return authState;
    },
    component: AuthedLayout
});

/**
 * AuthedLayout Component
 * Wraps all authenticated routes with AppLayout
 */
function AuthedLayout() {
    return (
        <AppLayout>
            <Outlet />
        </AppLayout>
    );
}
