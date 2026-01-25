import { useAuth, useUser } from '@clerk/tanstack-react-start';
import { useEffect, useRef, useState } from 'react';

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
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasSynced, setHasSynced] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    // Use refs to track sync state without causing re-renders
    const isSyncingRef = useRef(false);
    const hasSyncedRef = useRef(false);
    const retryCountRef = useRef(0);
    const maxRetries = 3;
    const retryDelayMs = 5000; // 5 seconds between retries

    useEffect(() => {
        const syncSession = async () => {
            // Only sync if:
            // 1. Clerk is loaded
            // 2. User is signed in
            // 3. We haven't synced yet
            // 4. We're not already syncing
            // 5. We haven't exceeded max retries
            if (
                !isLoaded ||
                !isSignedIn ||
                !user ||
                hasSyncedRef.current ||
                isSyncingRef.current ||
                retryCountRef.current >= maxRetries
            ) {
                return;
            }

            isSyncingRef.current = true;
            setIsSyncing(true);
            setSyncError(null);
            adminLogger.info('Starting automatic auth sync...', {
                attempt: retryCountRef.current + 1
            });

            try {
                // Try to sync with our backend
                const response = await fetchApi({
                    path: '/api/v1/public/auth/sync',
                    method: 'POST'
                });

                adminLogger.info('Auth sync response', {
                    status: response.status,
                    data: response.data
                });

                // Type the response - success has 'user', error has 'success: false'
                interface SyncSuccessResponse {
                    user: { id: string };
                }
                interface SyncErrorResponse {
                    success: false;
                    error: { code: string; message: string };
                }
                type SyncResponse = SyncSuccessResponse | SyncErrorResponse;
                const syncData = response.data as SyncResponse;

                // Check for actual success - 'user' field present means sync worked
                const isSuccess =
                    response.status >= 200 &&
                    response.status < 300 &&
                    'user' in syncData &&
                    syncData.user?.id;

                if (isSuccess) {
                    adminLogger.info('Auth sync successful');
                    hasSyncedRef.current = true;
                    setHasSynced(true);
                    retryCountRef.current = 0;

                    // Use window.location.href to force a full page reload
                    // This ensures the server receives the updated Clerk cookies
                    // router.navigate() does a client-side navigation that may not
                    // properly sync cookies for server-side auth checks
                    setTimeout(() => {
                        if (typeof window !== 'undefined') {
                            adminLogger.info('Redirecting to dashboard with full page reload');
                            window.location.href = '/dashboard';
                        }
                    }, 100); // Small delay to ensure state updates
                } else if (response.status === 429) {
                    // Rate limit exceeded - don't retry immediately
                    retryCountRef.current += 1;
                    const errorMsg = `Rate limited. Retry ${retryCountRef.current}/${maxRetries}`;
                    adminLogger.warn(errorMsg);
                    setSyncError(errorMsg);

                    // Schedule retry after delay if we haven't exceeded max retries
                    if (retryCountRef.current < maxRetries) {
                        adminLogger.info(`Will retry in ${retryDelayMs / 1000} seconds...`);
                        setTimeout(() => {
                            isSyncingRef.current = false;
                            setIsSyncing(false);
                            // Trigger a re-run by updating a dependency
                            setSyncError((prev) => prev); // Force effect to re-evaluate
                        }, retryDelayMs);
                        return; // Don't reset syncing state yet
                    }
                    adminLogger.error('Max retries exceeded for auth sync');
                    setSyncError('Authentication sync failed. Please refresh the page.');
                } else if (
                    'success' in syncData &&
                    !syncData.success &&
                    (syncData as SyncErrorResponse).error?.code === 'AUTH_NOT_READY'
                ) {
                    // Auth not ready yet (Clerk cookies not synced) - retry with delay
                    retryCountRef.current += 1;
                    const errorMsg = `Auth not ready. Retry ${retryCountRef.current}/${maxRetries}`;
                    adminLogger.warn(errorMsg);

                    if (retryCountRef.current < maxRetries) {
                        adminLogger.info(
                            `Clerk session not ready, will retry in ${retryDelayMs / 1000} seconds...`
                        );
                        setTimeout(() => {
                            isSyncingRef.current = false;
                            setIsSyncing(false);
                            setSyncError(null);
                        }, retryDelayMs);
                        return; // Don't reset syncing state yet
                    }
                    adminLogger.error('Max retries exceeded waiting for auth');
                    setSyncError('Authentication not ready. Please refresh the page.');
                } else {
                    // Other errors
                    const errorData = syncData as SyncErrorResponse;
                    const errorMsg =
                        errorData?.error?.message || `Sync failed with status ${response.status}`;
                    adminLogger.warn('Auth sync failed', {
                        status: response.status,
                        data: response.data
                    });
                    setSyncError(errorMsg);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                adminLogger.error('Auth sync failed', errorMessage);
                setSyncError(errorMessage);
            } finally {
                isSyncingRef.current = false;
                setIsSyncing(false);
            }
        };

        syncSession();
    }, [isLoaded, isSignedIn, user]);

    return {
        isSyncing,
        hasSynced,
        syncError,
        // Show signin form only when:
        // - Clerk is loaded AND
        // - User is definitively NOT signed in (no Clerk session)
        shouldShowSignIn: isLoaded && !isSignedIn,
        // Can safely redirect to protected routes when:
        // - Clerk is loaded AND
        // - User is signed in AND
        // - Backend sync has completed successfully
        canRedirectToProtected: isLoaded && isSignedIn && hasSynced
    };
};
