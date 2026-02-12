import { fetchAuthSession } from '@/lib/auth-session';
import { createFileRoute, isRedirect, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
    beforeLoad: async () => {
        try {
            const authState = await fetchAuthSession();

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
        } catch (error) {
            // Re-throw redirect errors - they're intentional and should not be caught
            if (isRedirect(error)) {
                throw error;
            }
            // If there's an actual error checking auth state, redirect to signin
            // The signin page will handle the sync automatically
            throw redirect({
                to: '/auth/signin'
            });
        }
    }
});
