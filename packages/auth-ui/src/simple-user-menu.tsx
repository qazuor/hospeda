/**
 * Simple user menu component for Better Auth.
 *
 * A compact user menu that shows user info and sign-out button inline.
 * Shows sign-in/sign-up links when not authenticated.
 *
 * @module simple-user-menu
 */

import { authLogger } from './logger';
import type { AuthSession } from './types';

/**
 * SimpleUserMenu component props
 */
export interface SimpleUserMenuProps {
    /** Current auth session (null if not authenticated) */
    session: AuthSession | null;
    /** Whether session is still loading */
    isPending?: boolean;
    /** Sign-out handler */
    onSignOut: () => Promise<void>;
    /** Redirect URL after sign-out */
    redirectTo?: string;
}

/**
 * SimpleUserMenu shows user info with inline sign-out or sign-in/sign-up links
 */
export const SimpleUserMenu = ({
    session,
    isPending = false,
    onSignOut,
    redirectTo = '/'
}: SimpleUserMenuProps) => {
    const handleSignOut = async () => {
        try {
            await onSignOut();
            if (redirectTo && typeof window !== 'undefined') {
                window.location.href = redirectTo;
            }
        } catch (error) {
            authLogger.error('Error during sign out', error);
        }
    };

    // Loading state
    if (isPending) {
        return (
            <div className="flex items-center space-x-2">
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
                <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            </div>
        );
    }

    // Not signed in state
    if (!session?.user) {
        return (
            <div className="flex items-center space-x-2">
                <a
                    href="/auth/signin/"
                    className="rounded-md px-3 py-2 font-medium text-gray-700 text-sm transition-colors hover:text-gray-900"
                >
                    Iniciar sesion
                </a>
                <a
                    href="/auth/signup/"
                    className="rounded-md bg-gradient-to-r from-cyan-500 to-green-500 px-4 py-2 font-medium text-sm text-white transition-all duration-200 hover:from-cyan-600 hover:to-green-600"
                >
                    Registrarse
                </a>
            </div>
        );
    }

    const { user } = session;
    const displayName = user.name || user.email || 'User';
    const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();

    // Signed in state
    return (
        <div className="flex items-center space-x-3">
            {/* User Avatar */}
            <div className="flex items-center space-x-2">
                {user.image ? (
                    <img
                        src={user.image}
                        alt={displayName}
                        className="h-8 w-8 rounded-full object-cover"
                    />
                ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-green-500 font-medium text-sm text-white">
                        {initial.toUpperCase()}
                    </div>
                )}

                {/* User Info */}
                <div className="hidden sm:block">
                    <div className="font-medium text-gray-900 text-sm">{displayName}</div>
                    <div className="text-gray-500 text-xs">{user.email}</div>
                </div>
            </div>

            {/* Sign Out Button */}
            <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-gray-700 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
            >
                Cerrar sesion
            </button>
        </div>
    );
};
