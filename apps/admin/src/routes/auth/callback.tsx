/**
 * OAuth callback route.
 *
 * With Better Auth, OAuth callbacks are handled by the API at
 * /api/auth/callback/:provider. This route serves as a landing page
 * that redirects to the dashboard after successful OAuth authentication.
 */

import { useSession } from '@/lib/auth-client';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';

export const Route = createFileRoute('/auth/callback')({
    component: AuthCallbackPage
});

/**
 * OAuth callback page that redirects after authentication
 */
function AuthCallbackPage(): React.JSX.Element {
    const router = useRouter();
    const { data: session, isPending } = useSession();

    useEffect(() => {
        if (isPending) return;

        if (session?.user) {
            // Authenticated, redirect to dashboard
            if (typeof window !== 'undefined') {
                window.location.href = '/dashboard';
            }
        } else {
            // Not authenticated, redirect to signin
            router.navigate({ to: '/auth/signin' });
        }
    }, [isPending, session, router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
            <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
                <p className="text-gray-600">Completing authentication...</p>
            </div>
        </div>
    );
}
