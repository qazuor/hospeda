import { fetchApi } from '@/lib/api/client';
import { useAuth, useUser } from '@clerk/clerk-react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { adminLogger } from '../../utils/logger';

export const Route = createFileRoute('/auth/callback')({
    component: AuthCallbackPage
});

/**
 * OAuth callback page that handles post-authentication sync
 */
function AuthCallbackPage(): React.JSX.Element {
    const router = useRouter();
    const { isSignedIn, isLoaded } = useAuth();
    const { user } = useUser();
    const [status, setStatus] = useState<'checking' | 'syncing' | 'redirecting' | 'error'>(
        'checking'
    );
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                adminLogger.info(
                    {
                        isLoaded,
                        isSignedIn,
                        user: !!user
                    },
                    'Auth callback - checking status'
                );

                if (!isLoaded) {
                    return; // Wait for Clerk to load
                }

                if (!isSignedIn || !user) {
                    adminLogger.info('Not signed in, redirecting to signin');
                    await router.navigate({ to: '/auth/signin' });
                    return;
                }

                adminLogger.info('User is signed in, syncing with backend...');
                setStatus('syncing');

                // Sync with backend
                const response = await fetchApi({
                    path: '/api/v1/public/auth/sync',
                    method: 'POST'
                });

                adminLogger.info(response.data, 'Sync result');

                if (response.status >= 200 && response.status < 300 && response.data?.success) {
                    adminLogger.info('Sync successful, redirecting to dashboard');
                    setStatus('redirecting');

                    // Get redirect URL from query params or default to root
                    const redirect =
                        (router.state.location.search as { redirect?: string })?.redirect || '/';
                    await router.navigate({ to: redirect });
                } else {
                    adminLogger.error(result, 'Sync failed');
                    setError(result.error?.message || 'Failed to sync user data');
                    setStatus('error');
                }
            } catch (err) {
                adminLogger.error(err, 'Callback error');
                setError(err instanceof Error ? err.message : 'Unknown error occurred');
                setStatus('error');
            }
        };

        void handleCallback();
    }, [isLoaded, isSignedIn, user, router]);

    if (status === 'checking') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
                    <p className="text-gray-600">Checking authentication...</p>
                </div>
            </div>
        );
    }

    if (status === 'syncing') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                    <p className="text-gray-600">Synchronizing your account...</p>
                </div>
            </div>
        );
    }

    if (status === 'redirecting') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-pulse rounded-full bg-green-500" />
                    <p className="text-gray-600">Success! Redirecting...</p>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
                <div className="mx-auto max-w-md p-8 text-center">
                    <div className="mx-auto mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-red-500">
                        <span className="text-lg text-white">!</span>
                    </div>
                    <h2 className="mb-2 font-semibold text-gray-900 text-xl">
                        Authentication Error
                    </h2>
                    <p className="mb-4 text-gray-600">{error}</p>
                    <button
                        type="button"
                        onClick={() => router.navigate({ to: '/auth/signin' })}
                        className="rounded-lg bg-cyan-600 px-4 py-2 text-white hover:bg-cyan-700"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100">
            <div className="text-center">
                <p className="text-gray-600">Processing...</p>
            </div>
        </div>
    );
}
