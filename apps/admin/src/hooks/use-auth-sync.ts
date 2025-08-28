import { useAuth, useUser } from '@clerk/tanstack-react-start';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';

/**
 * Hook for automatic authentication synchronization
 *
 * Handles the case where Clerk has a session but our backend doesn't.
 * Automatically syncs the session when needed.
 */
export const useAuthSync = () => {
    const { isSignedIn, isLoaded } = useAuth();
    const { user } = useUser();
    const router = useRouter();
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasSynced, setHasSynced] = useState(false);

    useEffect(() => {
        const syncSession = async () => {
            // Only sync if:
            // 1. Clerk is loaded
            // 2. User is signed in
            // 3. We haven't synced yet
            // 4. We're not already syncing
            if (!isLoaded || !isSignedIn || !user || hasSynced || isSyncing) {
                return;
            }

            setIsSyncing(true);
            adminLogger.info('Starting automatic auth sync...');

            try {
                // Try to sync with our backend
                const response = await fetchApi({
                    path: '/api/v1/public/auth/sync',
                    method: 'POST'
                });

                adminLogger.info({ status: response.status }, 'Auth sync response');

                if (response.status >= 200 && response.status < 300) {
                    adminLogger.info('Auth sync successful');
                    setHasSynced(true);

                    // Redirect to dashboard after successful sync
                    setTimeout(() => {
                        try {
                            router.navigate({ to: '/dashboard' });
                        } catch {
                            adminLogger.warn(
                                'Router navigation failed, using window.location fallback'
                            );
                            // Fallback to window.location if router fails
                            if (typeof window !== 'undefined') {
                                window.location.href = '/dashboard';
                            }
                        }
                    }, 100); // Small delay to ensure state updates
                } else {
                    adminLogger.warn(
                        { status: response.status, data: response.data },
                        'Auth sync failed with non-200 status'
                    );
                }
            } catch (error) {
                adminLogger.error(
                    'Auth sync failed:',
                    error instanceof Error ? error.message : String(error)
                );

                // If sync fails, we might need to sign out from Clerk
                // to force a fresh authentication flow
                // This is a fallback for cases where the backend session is corrupted
            } finally {
                setIsSyncing(false);
            }
        };

        syncSession();
    }, [isLoaded, isSignedIn, user, hasSynced, isSyncing, router]);

    return {
        isSyncing,
        hasSynced,
        shouldShowSignIn: isLoaded && !isSignedIn && !isSyncing
    };
};
