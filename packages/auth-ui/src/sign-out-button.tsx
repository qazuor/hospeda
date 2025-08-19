import { useAuth } from '@clerk/clerk-react';
import type { FC } from 'react';

/**
 * Props for the SignOutButton component
 */
export interface SignOutButtonProps {
    /** Optional callback when sign out is completed */
    onSignOut?: () => void;
    /** Custom CSS classes */
    className?: string;
    /** API base URL for sign out sync */
    apiBaseUrl?: string;
    /** Redirect URL after sign out */
    redirectTo?: string;
}

/**
 * SignOutButton component for logging out users
 *
 * @param props - The component props
 * @returns A button that signs out the current user
 */
export const SignOutButton: FC<SignOutButtonProps> = ({
    onSignOut,
    className = 'inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors',
    apiBaseUrl,
    redirectTo
}) => {
    const { signOut, isSignedIn } = useAuth();

    const handleSignOut = async () => {
        try {
            // Call API signout endpoint if provided
            if (apiBaseUrl) {
                try {
                    await fetch(`${apiBaseUrl}/api/v1/public/auth/signout`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include'
                    });
                } catch (apiError) {
                    console.warn('API signout failed, continuing with Clerk signout:', apiError);
                }
            }

            // Sign out from Clerk
            await signOut();

            // Call custom callback
            onSignOut?.();

            // Redirect if specified
            if (redirectTo) {
                window.location.href = redirectTo;
            }
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    if (!isSignedIn) {
        return null;
    }

    return (
        <button
            onClick={handleSignOut}
            className={className}
            type="button"
        >
            Cerrar sesión
        </button>
    );
};

/**
 * Debug component to clear Clerk session completely
 */
export const ClearSessionButton: FC = () => {
    const { signOut } = useAuth();

    const handleClearSession = async () => {
        try {
            await signOut({ sessionId: 'all' });
            // Also clear local storage
            localStorage.clear();
            sessionStorage.clear();
            // Reload the page
            window.location.reload();
        } catch (error) {
            console.error('Clear session error:', error);
        }
    };

    return (
        <button
            onClick={handleClearSession}
            className="rounded bg-yellow-500 px-2 py-1 text-white text-xs hover:bg-yellow-600"
            type="button"
            title="Clear all sessions and reload page"
        >
            Clear Session
        </button>
    );
};
