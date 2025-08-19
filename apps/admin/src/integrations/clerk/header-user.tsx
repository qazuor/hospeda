import { useAuthContext } from '@/contexts/auth-context';

/**
 * Optimized header user component using AuthContext
 * Shows user info and sign out button when authenticated
 */
export default function HeaderUser() {
    const { isAuthenticated, isLoading, user, signOut } = useAuthContext();

    if (isLoading) {
        return (
            <div className="flex items-center space-x-2">
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
                <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            </div>
        );
    }

    if (!isAuthenticated || !user) {
        return (
            <div className="text-gray-600 text-sm">
                <a
                    href="/auth/signin"
                    className="rounded-md bg-cyan-600 px-3 py-1.5 text-white transition-colors hover:bg-cyan-700"
                >
                    Sign In
                </a>
            </div>
        );
    }

    return (
        <div className="flex items-center space-x-3">
            {/* User Avatar */}
            <div className="flex items-center space-x-2">
                {user.avatar ? (
                    <img
                        src={user.avatar}
                        alt={user.displayName || 'User'}
                        className="h-8 w-8 rounded-full object-cover"
                    />
                ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600 font-medium text-sm text-white">
                        {(user.firstName?.[0] || user.displayName?.[0] || 'U').toUpperCase()}
                    </div>
                )}

                {/* User Info */}
                <div className="hidden sm:block">
                    <div className="font-medium text-gray-900 text-sm">
                        {user.displayName ||
                            `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                            'User'}
                    </div>
                    <div className="text-gray-500 text-xs">
                        {user.role.toLowerCase().replace('_', ' ')}
                    </div>
                </div>
            </div>

            {/* Sign Out Button */}
            <button
                type="button"
                onClick={() => signOut()}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-gray-700 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
            >
                Sign Out
            </button>
        </div>
    );
}
