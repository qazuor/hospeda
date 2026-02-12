/**
 * Authentication sync hook for Better Auth.
 *
 * With Better Auth, user records are created directly in the database
 * via database hooks, eliminating the need for a separate sync step.
 * This hook provides session state for auth pages (signin/signup).
 *
 * @module use-auth-sync
 */

import { useSession } from '@/lib/auth-client';

/**
 * Hook that provides auth state for sign-in/sign-up pages.
 *
 * With Better Auth, there is no separate sync step needed since
 * authentication is handled directly by the API. This hook wraps
 * the session check to provide a consistent interface.
 *
 * @returns Auth state for conditional rendering of auth forms
 */
export const useAuthSync = () => {
    const { data: session, isPending } = useSession();

    const isSignedIn = !!session?.user;

    return {
        /** Whether the session is still loading */
        isSyncing: isPending,
        /** Whether sync has completed (always true when not loading with Better Auth) */
        hasSynced: !isPending && isSignedIn,
        /** Error message if sync failed */
        syncError: null as string | null,
        /** Whether to show the sign-in/sign-up form (not signed in) */
        shouldShowSignIn: !isPending && !isSignedIn,
        /** Whether user can be redirected to protected routes */
        canRedirectToProtected: !isPending && isSignedIn
    };
};
