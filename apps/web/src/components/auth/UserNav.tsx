/**
 * User navigation component for the web app header.
 *
 * Shows sign-in/sign-up links when unauthenticated, or a user menu
 * with dropdown when authenticated. Uses Better Auth session state.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { signOut, useSession } from '../../lib/auth-client';

/**
 * UserNav renders auth navigation based on session state.
 * When authenticated, shows a dropdown menu with account links.
 */
export const UserNav = (): ReactNode => {
    const { data: session, isPending } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
        <div
            className="relative"
            ref={dropdownRef}
        >
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 rounded-md px-2 py-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <span className="hidden text-gray-700 text-sm sm:inline dark:text-gray-300">
                    {user.name || user.email}
                </span>
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
                <svg
                    className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
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
                <div className="absolute right-0 z-50 mt-2 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <a
                        href="/mi-cuenta/"
                        className="block px-4 py-2 text-gray-700 text-sm hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        Mi Cuenta
                    </a>
                    <a
                        href="/mi-cuenta/suscripcion/"
                        className="block px-4 py-2 text-gray-700 text-sm hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        Suscripcion
                    </a>
                    <div className="my-1 border-gray-200 border-t dark:border-gray-700" />
                    <button
                        type="button"
                        onClick={handleSignOut}
                        className="block w-full px-4 py-2 text-left text-gray-700 text-sm hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        Salir
                    </button>
                </div>
            )}
        </div>
    );
};
