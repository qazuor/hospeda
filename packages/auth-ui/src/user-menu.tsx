import { useAuth, useUser } from '@clerk/clerk-react';
import { useState } from 'react';

interface UserMenuProps {
    apiBaseUrl?: string;
}

export const UserMenu = ({ apiBaseUrl }: UserMenuProps) => {
    const { signOut } = useAuth();
    const { isLoaded, user } = useUser();
    const [isOpen, setIsOpen] = useState(false);

    if (!isLoaded) {
        return (
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
                <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
            </div>
        );
    }

    if (!user) return null;

    const handleSignOut = async () => {
        try {
            // Call API signout endpoint if provided (for Astro app)
            if (apiBaseUrl) {
                try {
                    await fetch(`${apiBaseUrl}/api/v1/public/auth/signout`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include'
                    });
                } catch (apiError) {
                    console.warn('API signout failed:', apiError);
                }
            }

            // Use Clerk signOut for proper session management
            await signOut();

            // Clerk will handle redirect automatically, but fallback to home if needed
            if (!window.location.pathname.includes('/auth')) {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                {user.imageUrl ? (
                    <img
                        src={user.imageUrl}
                        alt={user.fullName || 'Usuario'}
                        className="h-8 w-8 rounded-full object-cover"
                    />
                ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-green-500">
                        <span className="font-medium text-sm text-white">
                            {(user.fullName || user.primaryEmailAddress?.emailAddress || 'U')
                                .charAt(0)
                                .toUpperCase()}
                        </span>
                    </div>
                )}
                <span className="hidden font-medium text-gray-700 text-sm sm:block">
                    {user.fullName || user.primaryEmailAddress?.emailAddress}
                </span>
                <svg
                    className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                        onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
                        role="button"
                        tabIndex={0}
                        aria-label="Close menu"
                    />

                    {/* Menu */}
                    <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
                        <div className="border-gray-200 border-b p-4">
                            <div className="flex items-center gap-3">
                                {user.imageUrl ? (
                                    <img
                                        src={user.imageUrl}
                                        alt={user.fullName || 'Usuario'}
                                        className="h-10 w-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-green-500">
                                        <span className="font-medium text-white">
                                            {(
                                                user.fullName ||
                                                user.primaryEmailAddress?.emailAddress ||
                                                'U'
                                            )
                                                .charAt(0)
                                                .toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium text-gray-900 text-sm">
                                        {user.fullName || 'Usuario'}
                                    </p>
                                    <p className="truncate text-gray-500 text-xs">
                                        {user.primaryEmailAddress?.emailAddress}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="py-2">
                            <a
                                href={
                                    window.location.pathname.includes('/admin')
                                        ? '/destinations'
                                        : '/dashboard/'
                                }
                                className="flex items-center px-4 py-2 text-gray-700 text-sm transition-colors hover:bg-gray-50"
                                onClick={() => setIsOpen(false)}
                            >
                                <svg
                                    className="mr-3 h-4 w-4 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                    />
                                </svg>
                                Dashboard
                            </a>

                            <a
                                href={
                                    window.location.pathname.includes('/admin')
                                        ? '/me/profile'
                                        : '/profile/'
                                }
                                className="flex items-center px-4 py-2 text-gray-700 text-sm transition-colors hover:bg-gray-50"
                                onClick={() => setIsOpen(false)}
                            >
                                <svg
                                    className="mr-3 h-4 w-4 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                    />
                                </svg>
                                Mi Perfil
                            </a>

                            <button
                                type="button"
                                onClick={handleSignOut}
                                className="flex w-full items-center px-4 py-2 text-red-700 text-sm transition-colors hover:bg-red-50"
                            >
                                <svg
                                    className="mr-3 h-4 w-4 text-red-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                    />
                                </svg>
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
