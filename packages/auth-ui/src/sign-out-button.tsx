/**
 * Sign-out button component for Better Auth.
 *
 * A simple button that triggers sign-out and optional redirect.
 *
 * @module sign-out-button
 */

import type { FC } from 'react';
import { authLogger } from './logger';

/**
 * Props for the SignOutButton component
 */
export interface SignOutButtonProps {
    /** Whether the user is currently authenticated */
    isAuthenticated: boolean;
    /** Sign-out handler */
    onSignOut: () => Promise<void>;
    /** Optional callback after sign-out completes */
    onComplete?: () => void;
    /** Custom CSS classes */
    className?: string;
    /** Redirect URL after sign-out */
    redirectTo?: string;
}

/**
 * SignOutButton renders a button that signs out the current user
 */
export const SignOutButton: FC<SignOutButtonProps> = ({
    isAuthenticated,
    onSignOut,
    onComplete,
    className = 'inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors',
    redirectTo
}) => {
    const handleSignOut = async () => {
        try {
            await onSignOut();
            onComplete?.();
            if (redirectTo && typeof window !== 'undefined') {
                window.location.href = redirectTo;
            }
        } catch (error) {
            authLogger.error('Sign out error', error);
        }
    };

    if (!isAuthenticated) {
        return null;
    }

    return (
        <button
            onClick={handleSignOut}
            className={className}
            type="button"
        >
            Cerrar sesion
        </button>
    );
};
