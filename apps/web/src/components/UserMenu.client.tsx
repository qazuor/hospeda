/**
 * @file UserMenu.client.tsx
 * @description React island for the site header user menu.
 *
 * Renders a sign-in button when unauthenticated, or an avatar dropdown
 * when authenticated.
 *
 * Features:
 * - Unauthenticated: single "Iniciar sesión" button → /{locale}/auth/signin/
 * - Authenticated: avatar (image or initial-letter fallback) + dropdown with
 *   6 items: Mi cuenta, Editar perfil, Mis propiedades, Mis mensajes,
 *   Mis favoritos, Cerrar sesión.
 * - Closes on Escape, click-outside, or menu item click.
 * - Fully accessible: aria-expanded, aria-haspopup, role="menu", role="menuitem".
 *
 * Hydration: caller must use `client:load`.
 */

import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { signOut } from '../lib/auth-client';
import { getInitials } from '../lib/avatar-utils';
import { cn } from '../lib/cn';
import type { SupportedLocale } from '../lib/i18n';
import { buildUrl } from '../lib/urls';
import styles from './UserMenu.module.css';

// ---------------------------------------------------------------------------
// Localized texts (inline — avoids createTranslations import in an island)
// ---------------------------------------------------------------------------

const TEXTS = {
    es: {
        signIn: 'Iniciar sesión',
        myAccount: 'Mi cuenta',
        editProfile: 'Editar perfil',
        myProperties: 'Mis propiedades',
        myMessages: 'Mis mensajes',
        myFavorites: 'Mis favoritos',
        signOut: 'Cerrar sesión',
        openMenu: 'Abrir menú de usuario',
        closeMenu: 'Cerrar menú de usuario',
        userMenuLabel: 'Menú de cuenta'
    },
    en: {
        signIn: 'Sign in',
        myAccount: 'My account',
        editProfile: 'Edit profile',
        myProperties: 'My properties',
        myMessages: 'My messages',
        myFavorites: 'My favorites',
        signOut: 'Sign out',
        openMenu: 'Open user menu',
        closeMenu: 'Close user menu',
        userMenuLabel: 'Account menu'
    },
    pt: {
        signIn: 'Entrar',
        myAccount: 'Minha conta',
        editProfile: 'Editar perfil',
        myProperties: 'Meus imóveis',
        myMessages: 'Minhas mensagens',
        myFavorites: 'Meus favoritos',
        signOut: 'Sair',
        openMenu: 'Abrir menu do usuário',
        closeMenu: 'Fechar menu do usuário',
        userMenuLabel: 'Menu da conta'
    }
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Authenticated user data passed from the server.
 * When null the component renders a sign-in button.
 */
export interface UserMenuUser {
    /** Unique user identifier. */
    readonly id: string;
    /** Display name shown in the trigger and dropdown header. */
    readonly displayName: string;
    /** Optional avatar image URL. */
    readonly avatarUrl?: string | undefined;
    /** Optional user slug used for profile links. */
    readonly slug?: string | undefined;
}

/**
 * Props for the UserMenu island.
 */
export interface UserMenuProps {
    /**
     * Authenticated user, or null when the visitor is not signed in.
     * When null, a "Iniciar sesión" button is rendered.
     */
    readonly user: UserMenuUser | null;
    /** Current locale for building localized links. */
    readonly locale: SupportedLocale;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * UserMenu — header user menu island.
 *
 * @example
 * ```astro
 * <UserMenu user={user} locale={locale} client:load />
 * ```
 */
export function UserMenu({ user, locale }: UserMenuProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const texts = TEXTS[locale] ?? TEXTS.es;

    // Close dropdown when clicking outside.
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                triggerRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                !triggerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Close dropdown on Escape and restore focus.
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                triggerRef.current?.focus();
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
            window.location.href = buildUrl({ locale, path: '/' });
        }
    }, [locale]);

    const handleMenuItemClick = useCallback(() => {
        setIsOpen(false);
    }, []);

    // ── Unauthenticated: single sign-in link ─────────────────────────────────
    if (!user) {
        return (
            <a
                href={buildUrl({ locale, path: 'auth/signin' })}
                className={styles.signinLink}
            >
                {texts.signIn}
            </a>
        );
    }

    // ── Authenticated: avatar + dropdown ─────────────────────────────────────
    const initials = getInitials({ name: user.displayName, placeholder: '?' });

    return (
        <div className={styles.wrapper}>
            {/* Trigger button */}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-label={`${texts.openMenu}: ${user.displayName}`}
                className={styles.trigger}
            >
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
                <span className={styles.displayName}>{user.displayName}</span>
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label={texts.userMenuLabel}
                    className={styles.menu}
                >
                    {/* Mi cuenta */}
                    <a
                        href={buildUrl({ locale, path: 'mi-cuenta' })}
                        role="menuitem"
                        onClick={handleMenuItemClick}
                        className={styles.menuItem}
                    >
                        {texts.myAccount}
                    </a>

                    {/* Editar perfil */}
                    <a
                        href={buildUrl({ locale, path: 'mi-cuenta/editar' })}
                        role="menuitem"
                        onClick={handleMenuItemClick}
                        className={styles.menuItem}
                    >
                        {texts.editProfile}
                    </a>

                    {/* Mis propiedades */}
                    <a
                        href={buildUrl({ locale, path: 'mi-cuenta/propiedades' })}
                        role="menuitem"
                        onClick={handleMenuItemClick}
                        className={styles.menuItem}
                    >
                        {texts.myProperties}
                    </a>

                    {/* Mis mensajes */}
                    <a
                        href={buildUrl({ locale, path: 'mi-cuenta/mensajes' })}
                        role="menuitem"
                        onClick={handleMenuItemClick}
                        className={styles.menuItem}
                    >
                        {texts.myMessages}
                    </a>

                    {/* Mis favoritos */}
                    <a
                        href={buildUrl({ locale, path: 'mi-cuenta/favoritos' })}
                        role="menuitem"
                        onClick={handleMenuItemClick}
                        className={cn(styles.menuItem, styles.menuItemLast)}
                    >
                        {texts.myFavorites}
                    </a>

                    <hr className={styles.divider} />

                    {/* Cerrar sesión */}
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => void handleSignOut()}
                        className={styles.signOutButton}
                    >
                        {texts.signOut}
                    </button>
                </div>
            )}
        </div>
    );
}
