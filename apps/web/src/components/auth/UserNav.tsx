/**
 * User navigation component for the web app header.
 *
 * Shows sign-in/sign-up links when unauthenticated, or a user menu
 * when authenticated. Uses Better Auth session state.
 */

import type { ReactNode } from 'react';
import { signOut, useSession } from '../../lib/auth-client';

/**
 * UserNav renders auth navigation based on session state
 */
export const UserNav = (): ReactNode => {
    const { data: session, isPending } = useSession();

    if (isPending) {
        return <div className="h-8 w-20 animate-pulse rounded-md bg-gray-200" />;
    }

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

    const user = session.user;
    const initials = (user.name || user.email || '?')
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const handleSignOut = async () => {
        await signOut();
        if (typeof window !== 'undefined') {
            window.location.href = '/';
        }
    };

    return (
        <div className="flex items-center space-x-3">
            <span className="hidden text-gray-700 text-sm sm:inline">
                {user.name || user.email}
            </span>
            <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md px-3 py-1.5 font-medium text-gray-600 text-sm transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
                Salir
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600 font-medium text-sm text-white">
                {user.image ? (
                    <img
                        src={user.image}
                        alt={user.name || 'User'}
                        className="h-8 w-8 rounded-full object-cover"
                    />
                ) : (
                    initials
                )}
            </div>
        </div>
    );
};
