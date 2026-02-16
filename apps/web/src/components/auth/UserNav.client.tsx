import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { signOut } from '../../lib/auth-client';
import { buildUrl } from '../../lib/urls';

/**
 * User data for the UserNav component
 */
export interface UserNavUser {
    /**
     * User's display name
     */
    readonly name: string;

    /**
     * User's email address
     */
    readonly email: string;

    /**
     * Optional avatar image URL
     */
    readonly avatarUrl?: string;
}

/**
 * Props for the UserNav component
 */
export interface UserNavProps {
    /**
     * User data to display
     */
    readonly user: UserNavUser;

    /**
     * Locale for translations
     * @default 'es'
     */
    readonly locale?: 'es' | 'en' | 'pt';

    /**
     * Additional CSS classes to apply to the component
     */
    readonly className?: string;
}

/**
 * Translations for the UserNav component
 */
const translations = {
    es: {
        myAccount: 'Mi Cuenta',
        favorites: 'Favoritos',
        myReviews: 'Mis Reseñas',
        preferences: 'Preferencias',
        signOut: 'Cerrar sesión'
    },
    en: {
        myAccount: 'My Account',
        favorites: 'Favorites',
        myReviews: 'My Reviews',
        preferences: 'Preferences',
        signOut: 'Sign Out'
    },
    pt: {
        myAccount: 'Minha Conta',
        favorites: 'Favoritos',
        myReviews: 'Minhas Avaliações',
        preferences: 'Preferências',
        signOut: 'Sair'
    }
} as const;

/**
 * Get user initials from name
 *
 * @param params - Function parameters
 * @param params.name - User's full name
 * @returns User initials (max 2 characters)
 */
function getUserInitials({ name }: { readonly name: string }): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0];
    if (!first) return '';
    if (parts.length === 1) return first.charAt(0).toUpperCase();
    const last = parts[parts.length - 1];
    return `${first.charAt(0)}${last ? last.charAt(0) : ''}`.toUpperCase();
}

/**
 * UserNav component
 *
 * A user navigation dropdown menu displaying user information and account links.
 * Implements accessible menu pattern with keyboard support and click-outside handling.
 *
 * Features:
 * - Avatar display (or initials circle if no avatar)
 * - Dropdown menu with account links
 * - Multi-language support (es/en/pt)
 * - Keyboard navigation (Escape to close)
 * - Click outside to close
 * - Full ARIA compliance
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * <UserNav
 *   user={{
 *     name: "John Doe",
 *     email: "john@example.com",
 *     avatarUrl: "/avatar.jpg"
 *   }}
 *   locale="en"
 *   className="ml-auto"
 * />
 * ```
 */
export function UserNav({ user, locale = 'es', className = '' }: UserNavProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const t = translations[locale];
    const initials = getUserInitials({ name: user.name });

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                buttonRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [isOpen]);

    // Close menu on Escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                setIsOpen(false);
                buttonRef.current?.focus();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => {
                document.removeEventListener('keydown', handleEscape);
            };
        }
    }, [isOpen]);

    const handleToggle = () => {
        setIsOpen((prev) => !prev);
    };

    const handleSignOut = useCallback(async () => {
        setIsOpen(false);
        try {
            await signOut();
        } finally {
            // Reload the page to reflect signed-out state (server island will re-render)
            window.location.reload();
        }
    }, []);

    return (
        <div className={`relative inline-block ${className}`.trim()}>
            {/* Trigger Button */}
            <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-label={`User menu for ${user.name}`}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
                {/* Avatar or Initials */}
                {user.avatarUrl ? (
                    <img
                        src={user.avatarUrl}
                        alt=""
                        aria-hidden="true"
                        className="h-8 w-8 rounded-full object-cover"
                    />
                ) : (
                    <div
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-semibold text-sm text-white"
                        aria-hidden="true"
                    >
                        {initials}
                    </div>
                )}

                {/* User Name */}
                <span className="hidden sm:inline">{user.name}</span>

                {/* Chevron Icon */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label="User menu"
                    className="absolute top-full right-0 z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
                >
                    {/* User Info Header */}
                    <div className="border-gray-200 border-b px-4 py-3">
                        <p className="truncate font-semibold text-gray-900 text-sm">{user.name}</p>
                        <p className="truncate text-gray-500 text-xs">{user.email}</p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                        <a
                            href={buildUrl({ locale, path: 'mi-cuenta' })}
                            role="menuitem"
                            className="block px-4 py-2 text-gray-700 text-sm transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none"
                        >
                            {t.myAccount}
                        </a>
                        <a
                            href={buildUrl({ locale, path: 'mi-cuenta/favoritos' })}
                            role="menuitem"
                            className="block px-4 py-2 text-gray-700 text-sm transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none"
                        >
                            {t.favorites}
                        </a>
                        <a
                            href={buildUrl({ locale, path: 'mi-cuenta/resenas' })}
                            role="menuitem"
                            className="block px-4 py-2 text-gray-700 text-sm transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none"
                        >
                            {t.myReviews}
                        </a>
                        <a
                            href={buildUrl({ locale, path: 'mi-cuenta/preferencias' })}
                            role="menuitem"
                            className="block px-4 py-2 text-gray-700 text-sm transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none"
                        >
                            {t.preferences}
                        </a>
                    </div>

                    {/* Separator */}
                    <hr className="my-1 border-gray-200" />

                    {/* Sign Out Button */}
                    <div className="py-1">
                        <button
                            type="button"
                            onClick={() => void handleSignOut()}
                            role="menuitem"
                            className="block w-full px-4 py-2 text-left text-red-600 text-sm transition-colors hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none"
                        >
                            {t.signOut}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
