/**
 * @file MobileMenu.client.tsx
 * @description Full-screen mobile navigation overlay island.
 *
 * Slides in from the right when the element with `[data-mobile-toggle]`
 * is clicked. Closes on:
 * - The close button (CloseIcon)
 * - ESC key press
 * - `astro:before-swap` event (ClientRouter page navigation)
 *
 * Applies a body scroll lock while open and releases it on close.
 * Traps focus on the close button when the menu opens.
 *
 * Tasks: T-074
 */

import { IconButton } from '@/components/ui/IconButtonReact';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import {
    BuildingIcon,
    ChevronDownIcon,
    CloseIcon,
    LogoutIcon,
    MoonIcon,
    SearchIcon,
    SunIcon,
    UserIcon
} from '@repo/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './MobileMenu.module.css';

// ---------------------------------------------------------------------------
// Localized texts for the auth section
// ---------------------------------------------------------------------------

const AUTH_TEXTS = {
    es: {
        myAccount: 'Mi cuenta',
        favorites: 'Favoritos',
        myReviews: 'Mis resenas',
        preferences: 'Preferencias',
        signOut: 'Cerrar sesion'
    },
    en: {
        myAccount: 'My account',
        favorites: 'Favorites',
        myReviews: 'My reviews',
        preferences: 'Preferences',
        signOut: 'Sign out'
    },
    pt: {
        myAccount: 'Minha conta',
        favorites: 'Favoritos',
        myReviews: 'Minhas avaliacoes',
        preferences: 'Preferencias',
        signOut: 'Sair'
    }
} as const;

/**
 * Returns up to two uppercase initials from a full name.
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
// Types
// ---------------------------------------------------------------------------

/** A single navigation link entry. */
interface NavItem {
    /** Display label shown in the menu. */
    readonly label: string;
    /** Destination href for the link. */
    readonly href: string;
}

/** Authenticated user data passed from the server. */
interface MobileMenuUser {
    /** User's display name. */
    readonly name: string;
    /** User's email address. */
    readonly email: string;
    /** Optional avatar image URL. */
    readonly image?: string;
}

/** Props for the MobileMenu component. */
interface MobileMenuProps {
    /** Active locale .. passed through for future i18n use. */
    readonly locale: SupportedLocale;
    /** Navigation items rendered as vertical links. */
    readonly navItems: readonly NavItem[];
    /** Current page path — used to build locale-swap URLs for the language switcher. */
    readonly currentPath: string;
    /** Resolved logo image URL (from astro:assets). */
    readonly logoSrc: string;
    /** Home URL for the logo link. */
    readonly homeHref: string;
    /** Authenticated user data (null/undefined when not logged in). */
    readonly user?: MobileMenuUser | null;
    /** Label for the owner CTA button. */
    readonly ctaLabel?: string;
    /** Destination href for the owner CTA button. */
    readonly ctaHref?: string;
}

// ---------------------------------------------------------------------------
// MobileMenu
// ---------------------------------------------------------------------------

/**
 * Full-screen mobile navigation overlay.
 *
 * The component listens for clicks on the first `[data-mobile-toggle]`
 * element in the document (typically the hamburger button inside
 * `Header.astro`) and toggles the overlay.
 *
 * Body scroll is locked while the menu is open and restored on close.
 * All event listeners are cleaned up on unmount or when conditions change.
 *
 * @example
 * ```astro
 * ---
 * import MobileMenu from '@/components/shared/navigation/MobileMenu.client';
 * ---
 * <MobileMenu locale={locale} navItems={navItems} client:media="(max-width: 768px)" />
 * ```
 */
export function MobileMenu({
    locale,
    navItems,
    currentPath,
    logoSrc,
    homeHref,
    user,
    ctaLabel,
    ctaHref
}: MobileMenuProps) {
    const { t } = createTranslations(locale);
    const [isOpen, setIsOpen] = useState(false);
    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const authTexts = AUTH_TEXTS[locale] ?? AUTH_TEXTS.es;

    // Read initial theme from localStorage on mount.
    useEffect(() => {
        const stored = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDark(stored ? stored === 'dark' : prefersDark);
    }, []);

    const handleThemeToggle = useCallback(() => {
        const next = !isDark;
        setIsDark(next);
        if (next) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    // ------------------------------------------------------------------
    // Toggle handler .. wired to the external [data-mobile-toggle] button
    // ------------------------------------------------------------------
    useEffect(() => {
        const toggle = document.querySelector('[data-mobile-toggle]');
        if (!toggle) return;

        const handler = () => setIsOpen((prev) => !prev);
        toggle.addEventListener('click', handler);
        return () => {
            toggle.removeEventListener('click', handler);
        };
    }, []);

    // ------------------------------------------------------------------
    // ESC key closes the menu
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    // ------------------------------------------------------------------
    // astro:before-swap closes the menu on ClientRouter navigation
    // ------------------------------------------------------------------
    useEffect(() => {
        const handleBeforeSwap = () => setIsOpen(false);
        document.addEventListener('astro:before-swap', handleBeforeSwap);
        return () => {
            document.removeEventListener('astro:before-swap', handleBeforeSwap);
        };
    }, []);

    // ------------------------------------------------------------------
    // Body scroll lock
    // ------------------------------------------------------------------
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.documentElement.setAttribute('data-mobile-menu-open', '');
            // Move focus to the close button for accessibility
            closeButtonRef.current?.focus();
        } else {
            document.body.style.overflow = previousOverflow;
            document.documentElement.removeAttribute('data-mobile-menu-open');
        }

        return () => {
            document.body.style.overflow = previousOverflow;
            document.documentElement.removeAttribute('data-mobile-menu-open');
        };
    }, [isOpen]);

    // ------------------------------------------------------------------
    // Close handler
    // ------------------------------------------------------------------
    const handleClose = useCallback(() => {
        setIsOpen(false);
        setIsAccountOpen(false);
    }, []);

    // ------------------------------------------------------------------
    // Sign out handler
    // ------------------------------------------------------------------
    const handleSignOut = useCallback(async () => {
        setIsSigningOut(true);
        try {
            await signOut();
        } finally {
            window.location.reload();
        }
    }, []);

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    return (
        <div
            // biome-ignore lint/a11y/useSemanticElements: CSS-animated overlay; <dialog> open/close API would conflict with the slide-in animation
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.mobileMenu', 'Navigation menu')}
            aria-hidden={!isOpen}
            className={cn(styles.overlay, isOpen && styles.overlayOpen)}
        >
            {/* Header row: logo + close button */}
            <div className={styles.header}>
                <a
                    href={homeHref}
                    onClick={handleClose}
                    tabIndex={isOpen ? 0 : -1}
                    className={styles.logoLink}
                    aria-label={t('nav.goHome', 'Hospeda - Go to home')}
                >
                    <img
                        src={logoSrc}
                        alt="Hospeda logo"
                        className={styles.logoIcon}
                        width={36}
                        height={39}
                    />
                    <span className={styles.logoText}>Hospeda</span>
                </a>
                <IconButton
                    ref={closeButtonRef}
                    ariaLabel={t('nav.closeMenu', 'Close navigation menu')}
                    variant="ghost"
                    size="md"
                    onClick={handleClose}
                    tabIndex={isOpen ? 0 : -1}
                >
                    <CloseIcon
                        size={24}
                        weight="regular"
                        aria-hidden="true"
                    />
                </IconButton>
            </div>

            {/* Navigation links */}
            <nav
                aria-label={t('nav.mainNavigation', 'Main navigation')}
                className={styles.nav}
            >
                <ul className={styles.navList}>
                    {navItems.map((item) => (
                        <li key={item.href}>
                            <a
                                href={item.href}
                                onClick={handleClose}
                                tabIndex={isOpen ? 0 : -1}
                                className={styles.navLink}
                            >
                                {item.label}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Auth section */}
            <div className={styles.authSection}>
                {ctaLabel && ctaHref && (
                    <a
                        href={ctaHref}
                        onClick={handleClose}
                        tabIndex={isOpen ? 0 : -1}
                        className={styles.ctaLink}
                    >
                        <BuildingIcon
                            size={18}
                            weight="regular"
                            aria-hidden="true"
                        />
                        {ctaLabel}
                    </a>
                )}
                {user ? (
                    <>
                        {/* User profile row with expandable account menu */}
                        <button
                            type="button"
                            onClick={() => setIsAccountOpen((prev) => !prev)}
                            tabIndex={isOpen ? 0 : -1}
                            className={styles.userRow}
                            aria-expanded={isAccountOpen}
                        >
                            {user.image ? (
                                <img
                                    src={user.image}
                                    alt=""
                                    aria-hidden="true"
                                    className={styles.userAvatar}
                                />
                            ) : (
                                <span
                                    aria-hidden="true"
                                    className={styles.userInitials}
                                >
                                    {getInitials({ name: user.name ?? '' })}
                                </span>
                            )}
                            <span className={styles.userName}>{user.name ?? 'Usuario'}</span>
                            <span
                                aria-hidden="true"
                                className={cn(
                                    styles.userChevron,
                                    isAccountOpen && styles.userChevronOpen
                                )}
                            >
                                <ChevronDownIcon size={18} />
                            </span>
                        </button>

                        {/* Expandable account links */}
                        {isAccountOpen && (
                            <div className={styles.accountLinks}>
                                <a
                                    href={buildUrl({ locale, path: 'mi-cuenta' })}
                                    onClick={handleClose}
                                    tabIndex={isOpen ? 0 : -1}
                                    className={styles.accountLink}
                                >
                                    <UserIcon
                                        size={18}
                                        aria-hidden="true"
                                    />
                                    {authTexts.myAccount}
                                </a>
                                <a
                                    href={buildUrl({ locale, path: 'mi-cuenta/favoritos' })}
                                    onClick={handleClose}
                                    tabIndex={isOpen ? 0 : -1}
                                    className={styles.accountLink}
                                >
                                    {authTexts.favorites}
                                </a>
                                <a
                                    href={buildUrl({ locale, path: 'mi-cuenta/resenas' })}
                                    onClick={handleClose}
                                    tabIndex={isOpen ? 0 : -1}
                                    className={styles.accountLink}
                                >
                                    {authTexts.myReviews}
                                </a>
                                <a
                                    href={buildUrl({ locale, path: 'mi-cuenta/preferencias' })}
                                    onClick={handleClose}
                                    tabIndex={isOpen ? 0 : -1}
                                    className={styles.accountLink}
                                >
                                    {authTexts.preferences}
                                </a>
                                <button
                                    type="button"
                                    onClick={() => void handleSignOut()}
                                    disabled={isSigningOut}
                                    tabIndex={isOpen ? 0 : -1}
                                    className={styles.signOutButton}
                                >
                                    <LogoutIcon
                                        size={18}
                                        aria-hidden="true"
                                    />
                                    {isSigningOut ? '...' : authTexts.signOut}
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <a
                        href={`/${locale}/auth/signin/`}
                        onClick={handleClose}
                        tabIndex={isOpen ? 0 : -1}
                        className={styles.authButton}
                    >
                        {t('nav.signIn', 'Iniciar sesión')}
                    </a>
                )}
            </div>

            {/* Language switcher */}
            <div className={styles.langSection}>
                {(['es', 'en', 'pt'] as const).map((loc) => {
                    const pathWithoutLocale = currentPath.replace(/^\/(es|en|pt)(\/|$)/, '/');
                    const localeUrl = `/${loc}${pathWithoutLocale}`;
                    return (
                        <a
                            key={loc}
                            href={localeUrl}
                            onClick={handleClose}
                            tabIndex={isOpen ? 0 : -1}
                            className={cn(
                                styles.langOption,
                                loc === locale && styles.langOptionActive
                            )}
                            aria-current={loc === locale ? 'true' : undefined}
                        >
                            {loc.toUpperCase()}
                        </a>
                    );
                })}
                <IconButton
                    variant="outline"
                    size="sm"
                    ariaLabel={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                    aria={{ pressed: isDark }}
                    onClick={handleThemeToggle}
                    tabIndex={isOpen ? 0 : -1}
                    className={styles.themeTogglePlacement}
                >
                    {isDark ? (
                        <MoonIcon
                            size={18}
                            weight="regular"
                            aria-hidden="true"
                        />
                    ) : (
                        <SunIcon
                            size={18}
                            weight="regular"
                            aria-hidden="true"
                        />
                    )}
                </IconButton>
            </div>

            {/* Bottom search link */}
            <div className={styles.footer}>
                <a
                    href="/busqueda/"
                    onClick={handleClose}
                    tabIndex={isOpen ? 0 : -1}
                    aria-label={t('nav.goToSearch', 'Go to search')}
                    className={styles.searchLink}
                >
                    <SearchIcon
                        size={20}
                        weight="regular"
                        aria-hidden="true"
                    />
                    <span className={styles.searchLabel}>Buscar alojamientos</span>
                </a>
            </div>
        </div>
    );
}
