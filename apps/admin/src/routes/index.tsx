import { getAuth } from '@clerk/tanstack-react-start/server';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getWebRequest } from '@tanstack/react-start/server';

/**
 * Server function to check authentication
 */
const fetchAuthState = createServerFn({ method: 'GET' }).handler(async () => {
    const request = getWebRequest();
    if (!request) {
        return { userId: null, isAuthenticated: false };
    }

    const { userId } = await getAuth(request);

    return {
        userId,
        isAuthenticated: !!userId
    };
});

export const Route = createFileRoute('/')({
    beforeLoad: async () => {
        try {
            const authState = await fetchAuthState();

            // If authenticated, redirect to dashboard
            if (authState.isAuthenticated) {
                throw redirect({
                    to: '/dashboard'
                });
            }

            // If not authenticated, redirect to signin page
            // The signin page will handle automatic sync if needed
            throw redirect({
                to: '/auth/signin'
            });
        } catch {
            // If there's an error checking auth state, redirect to signin
            // The signin page will handle the sync automatically
            throw redirect({
                to: '/auth/signin'
            });
        }
    }
});
