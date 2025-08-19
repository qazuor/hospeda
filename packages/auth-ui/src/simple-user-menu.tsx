import { useAuth, useUser } from '@clerk/clerk-react';

interface Props {
    apiBaseUrl?: string;
    redirectTo?: string;
    refreshAuthContext?: () => Promise<void>; // Function to refresh auth context
}

/**
 * SimpleUserMenu
 * A simple user menu component that shows user info and provides sign out functionality
 * Uses Clerk hooks directly - expects to be wrapped in ClerkProvider
 */
export const SimpleUserMenu = ({ apiBaseUrl, redirectTo = '/', refreshAuthContext }: Props) => {
    const { isLoaded, isSignedIn, signOut } = useAuth();
    const { user } = useUser();

    // Use Clerk data directly
    const isLoading = !isLoaded;
    const isAuthenticated = isSignedIn;
    const signOutFn = signOut;

    /**
     * Handle sign out
     */
    const handleSignOut = async () => {
        try {
            // Call backend signout endpoint if apiBaseUrl is provided
            if (apiBaseUrl) {
                await fetch(`${apiBaseUrl}/api/v1/public/auth/signout`, {
                    method: 'POST',
                    credentials: 'include'
                });
            }

            // Refresh auth context if available
            if (refreshAuthContext) {
                try {
                    await refreshAuthContext();
                } catch (error) {
                    console.warn('Failed to refresh auth context:', error);
                }
            }

            // Sign out from Clerk
            await signOutFn();

            // Redirect to specified location
            if (redirectTo) {
                window.location.href = redirectTo;
            }
        } catch (error) {
            console.error('Error during sign out:', error);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center space-x-2">
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
                <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            </div>
        );
    }

    // Not signed in state
    if (!isAuthenticated || !user) {
        return (
            <div className="flex items-center space-x-2">
                <a
                    href="/auth/signin/"
                    className="rounded-md px-3 py-2 font-medium text-gray-700 text-sm transition-colors hover:text-gray-900"
                >
                    Iniciar sesión
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

    // Get user display data from Clerk
    const displayName =
        user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Usuario';
    const email = user.primaryEmailAddress?.emailAddress || 'Sin email';
    const avatar = user.imageUrl;
    const initials = user.firstName?.[0] || user.fullName?.[0] || 'U';

    // Signed in state
    return (
        <div className="flex items-center space-x-3">
            {/* User Avatar */}
            <div className="flex items-center space-x-2">
                {avatar ? (
                    <img
                        src={avatar}
                        alt={displayName}
                        className="h-8 w-8 rounded-full object-cover"
                    />
                ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-green-500 font-medium text-sm text-white">
                        {initials.toUpperCase()}
                    </div>
                )}

                {/* User Info */}
                <div className="hidden sm:block">
                    <div className="font-medium text-gray-900 text-sm">{displayName}</div>
                    <div className="text-gray-500 text-xs">{email}</div>
                </div>
            </div>

            {/* Sign Out Button */}
            <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-gray-700 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
            >
                Cerrar sesión
            </button>
        </div>
    );
};
