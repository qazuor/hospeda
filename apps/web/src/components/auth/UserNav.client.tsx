/**
 * @file UserNav.client.tsx
 * @description Interactive user menu island for the site header.
 *
 * Renders a compact trigger button (avatar or initials + display name) that opens
 * a dropdown with account navigation links and a sign-out action.
 *
 * Features:
 * - Closes on Escape key, click-outside, or navigation link click
 * - Reacts to the custom `navbar:scroll` event dispatched by Navbar.astro
 *   so button colours stay consistent with the current scroll state
 * - Fully accessible: `role="menu"`, `aria-expanded`, `aria-haspopup`, focus management
 * - Styled with CSS Modules using design tokens from global.css (no Tailwind)
 */

import { ChevronDownIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { signOut } from '../../lib/auth-client';
import { cn } from '../../lib/cn';
import type { SupportedLocale } from '../../lib/i18n';
import { buildUrl } from '../../lib/urls';
import styles from './UserNav.module.css';

// ---------------------------------------------------------------------------
// Localized texts
// ---------------------------------------------------------------------------

const LOCALIZED_TEXTS = {
    es: {
        myAccount: 'Mi cuenta',
        favorites: 'Favoritos',
        myReviews: 'Mis resenas',
        preferences: 'Preferencias',
        signOut: 'Cerrar sesion',
        userMenuFor: 'Menu de usuario para',
        userAccountMenu: 'Menu de cuenta de usuario'
    },
    en: {
        myAccount: 'My account',
        favorites: 'Favorites',
        myReviews: 'My reviews',
        preferences: 'Preferences',
        signOut: 'Sign out',
        userMenuFor: 'User menu for',
        userAccountMenu: 'User account menu'
    },
    pt: {
        myAccount: 'Minha conta',
        favorites: 'Favoritos',
        myReviews: 'Minhas avaliacoes',
        preferences: 'Preferencias',
        signOut: 'Sair',
        userMenuFor: 'Menu do usuario para',
        userAccountMenu: 'Menu da conta do usuario'
    }
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * User data passed to the UserNav component from the server.
 */
export interface UserNavUser {
    /** User's display name */
    readonly name: string;
    /** User's email address */
    readonly email: string;
    /** Optional avatar image URL */
    readonly avatarUrl?: string;
}

/**
 * Props for the UserNav component.
 */
export interface UserNavProps {
    /** User data to display */
    readonly user: UserNavUser;
    /** Current locale for building account links. Defaults to 'es'. */
    readonly locale?: string;
    /**
     * Visual variant that mirrors the navbar's scroll state.
     * - "hero": transparent navbar (light text on dark overlay)
     * - "scrolled": opaque navbar (dark text on light background)
     */
    readonly variant?: 'hero' | 'scrolled';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns up to two uppercase initials from a full name.
 *
 * @param params.name - Full display name
 * @returns One or two uppercase characters
 */
function getInitials({ name }: { readonly name: string }): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0];
    if (!first) return '';
    if (parts.length === 1) return first.charAt(0).toUpperCase();
    const last = parts[parts.length - 1];
    return `${first.charAt(0)}${last ? last.charAt(0) : ''}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * UserNav - interactive user menu island for the site header.
 *
 * @example
 * ```astro
 * <UserNav client:load user={user} locale={locale} variant="hero" />
 * ```
 */
export function UserNav({
    user,
    locale = 'es',
    variant: initialVariant = 'hero'
}: UserNavProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);
    const [activeVariant, setActiveVariant] = useState<'hero' | 'scrolled'>(initialVariant);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const initials = getInitials({ name: user.name });

    // Sync button appearance with the navbar's scroll-state custom event.
    useEffect(() => {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;

        const handleNavbarScroll = (event: Event) => {
            const customEvent = event as CustomEvent<{ scrolled: boolean }>;
            setActiveVariant(customEvent.detail.scrolled ? 'scrolled' : 'hero');
        };

        navbar.addEventListener('navbar:scroll', handleNavbarScroll);
        return () => {
            navbar.removeEventListener('navbar:scroll', handleNavbarScroll);
        };
    }, []);

    // Close dropdown when clicking outside.
    useEffect(() => {
        if (!isOpen) return;

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

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Close dropdown on Escape.
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                buttonRef.current?.focus();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen]);

    const handleSignOut = useCallback(async () => {
        setIsOpen(false);
        try {
            await signOut();
        } finally {
            window.location.reload();
        }
    }, []);

    const typedLocale = locale as SupportedLocale;
    const texts = LOCALIZED_TEXTS[typedLocale] ?? LOCALIZED_TEXTS.es;

    return (
        <div className={styles.wrapper}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-label={`${texts.userMenuFor} ${user.name}`}
                className={cn(
                    styles.button,
                    activeVariant === 'scrolled' && styles['button--scrolled']
                )}
            >
                {/* Avatar image or initials fallback */}
                {user.avatarUrl ? (
                    <img
                        src={user.avatarUrl}
                        alt=""
                        aria-hidden="true"
                        className={styles.avatar}
                    />
                ) : (
                    <span
                        aria-hidden="true"
                        className={styles.initials}
                    >
                        {initials}
                    </span>
                )}

                {/* Display name (hidden on very small screens via CSS Module) */}
                <span className={styles.name}>{user.name}</span>

                {/* Chevron icon */}
                <span
                    aria-hidden="true"
                    className={cn(styles.chevron, isOpen && styles.chevronOpen)}
                >
                    <ChevronDownIcon size={14} />
                </span>
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label={texts.userAccountMenu}
                    className={styles.menu}
                >
                    {/* User info header */}
                    <div className={styles.menuHeader}>
                        <p className={styles.menuHeaderName}>{user.name}</p>
                        <p className={styles.menuHeaderEmail}>{user.email}</p>
                    </div>

                    {/* Account navigation links */}
                    <div className={styles.menuLinks}>
                        <a
                            href={buildUrl({ locale: typedLocale, path: 'mi-cuenta' })}
                            role="menuitem"
                            onClick={() => setIsOpen(false)}
                            className={styles.menuLink}
                        >
                            {texts.myAccount}
                        </a>
                        <a
                            href={buildUrl({ locale: typedLocale, path: 'mi-cuenta/favoritos' })}
                            role="menuitem"
                            onClick={() => setIsOpen(false)}
                            className={styles.menuLink}
                        >
                            {texts.favorites}
                        </a>
                        <a
                            href={buildUrl({ locale: typedLocale, path: 'mi-cuenta/resenas' })}
                            role="menuitem"
                            onClick={() => setIsOpen(false)}
                            className={styles.menuLink}
                        >
                            {texts.myReviews}
                        </a>
                        <a
                            href={buildUrl({ locale: typedLocale, path: 'mi-cuenta/preferencias' })}
                            role="menuitem"
                            onClick={() => setIsOpen(false)}
                            className={styles.menuLink}
                        >
                            {texts.preferences}
                        </a>
                    </div>

                    <hr className={styles.divider} />

                    {/* Sign-out action */}
                    <div className={styles.signOutSection}>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => void handleSignOut()}
                            className={styles.signOutButton}
                        >
                            {texts.signOut}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
