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
 * The account accordion (identity "Mi cuenta" link + Favoritos + ONE
 * business-panel shortcut + Suscripción) renders the SAME curated set as
 * the avatar dropdown (`UserMenu.client.tsx`), via `getCuratedAccountNav`
 * (HOS-131 §6.5 mobile "option A" — one curated set, not two divergent
 * lists). The session zone (language, theme, sign-out, and — staff only —
 * the admin-panel link built by the shared `buildAdminPanelItem`,
 * `@/lib/admin-panel-link`) mirrors UserMenu's session zone too.
 *
 * Since this island only receives `{ name, email, image }` from the server
 * (no permissions), it resolves the effective permission list itself on
 * mount via `useAccountPermissions` (`@/hooks/use-account-permissions`) —
 * the SAME shared hook `UserMenu.client.tsx` uses, never a second mechanism.
 *
 * Tasks: T-074
 */

import { CloseIcon, SearchIcon } from '@repo/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageSwitcher } from '@/components/shared/preferences/LanguageSwitcher.client';
import { ThemeControl } from '@/components/shared/preferences/ThemeControl.client';
import { IconButton } from '@/components/ui/IconButtonReact';
import type { NavItem as AccountNavItem } from '@/config/navigation';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { buildAdminPanelItem } from '@/lib/admin-panel-link';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { getCuratedAccountNav } from '@/lib/nav-avatar';
import styles from './MobileMenu.module.css';
import { MobileMenuAccountSection } from './MobileMenuAccountSection.client';

// ---------------------------------------------------------------------------
// Localized texts for the auth section
// ---------------------------------------------------------------------------
// Curated nav item labels (dashboard/favorites/business shortcut/subscription)
// resolve via t(item.i18nKey) from the shared ACCOUNT_NAV_GROUPS config —
// only the sign-out labels stay local, as they aren't nav config items.

const AUTH_TEXTS = {
    es: {
        signOut: 'Cerrar sesion',
        signingOut: 'Cerrando sesion…'
    },
    en: {
        signOut: 'Sign out',
        signingOut: 'Signing out…'
    },
    pt: {
        signOut: 'Sair',
        signingOut: 'Saindo…'
    }
} as const;

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
    /**
     * Admin panel base URL for the session-zone admin-panel link (HOS-131
     * §6.5, staff/host only, gated by `access.panelAdmin`). `undefined`
     * (env var not configured) always hides the link.
     */
    readonly adminPanelUrl?: string;
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
    ctaHref,
    adminPanelUrl
}: MobileMenuProps) {
    const { t } = createTranslations(locale);
    const [isOpen, setIsOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const authTexts = AUTH_TEXTS[locale] ?? AUTH_TEXTS.es;

    // ------------------------------------------------------------------
    // Resolve effective permissions for the curated account block + the
    // admin-panel session link. Simple mode (no `initialUser`) — this
    // island already has its own SSR `user` prop, so it skips entirely for
    // guests and never touches `data-user-authenticated` (that's UserMenu's
    // responsibility). Uses the SAME shared hook as UserMenu.client.tsx —
    // never a second mechanism.
    // ------------------------------------------------------------------
    const { permissions } = useAccountPermissions({ skip: !user });

    // ------------------------------------------------------------------
    // Curated account nav (identity "Mi cuenta" link + Favoritos + business
    // shortcut + Suscripción) — the SAME curated set as UserMenu's avatar
    // dropdown (HOS-131 §6.5 mobile "option A"). Fail-closed while
    // `permissions` is still loading via `permissions ?? []`.
    // ------------------------------------------------------------------
    const avatarNav = useMemo(
        () => getCuratedAccountNav({ permissions: permissions ?? [] }),
        [permissions]
    );
    const curatedAccountItems = useMemo(
        () =>
            [avatarNav.dashboardItem, ...avatarNav.shortcutItems].filter(
                (item): item is AccountNavItem => item !== null
            ),
        [avatarNav]
    );

    // ------------------------------------------------------------------
    // Admin panel session item (HOS-131 §6.5, staff/host only). Hidden
    // while permissions are loading (fail-closed) — same contract as
    // UserMenu.client.tsx. Naturally stays null for guests too, since
    // `permissions` never resolves past `null` when `skip: !user` is set.
    // ------------------------------------------------------------------
    const adminPanelItem = useMemo(() => {
        if (permissions === null) return null;
        return buildAdminPanelItem({ locale, adminPanelUrl, permissions });
    }, [locale, adminPanelUrl, permissions]);

    // ------------------------------------------------------------------
    // Toggle handler — listens for a window-level CustomEvent dispatched
    // by the hamburger button. This keeps the wiring resilient to View
    // Transitions: even when ClientRouter swaps the header DOM and the old
    // hamburger node disappears, the new one re-dispatches the same event
    // and this listener (registered once on the window) keeps working.
    // ------------------------------------------------------------------
    useEffect(() => {
        const handler = () => setIsOpen((prev) => !prev);
        window.addEventListener('mobile-menu:toggle', handler);
        return () => {
            window.removeEventListener('mobile-menu:toggle', handler);
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
    // Scroll lock
    //
    // Applied to <html>, NOT <body>. Setting `overflow: hidden` on the
    // body breaks the header's `position: sticky` because the body is the
    // sticky scroll container — the header collapses back to its natural
    // y=0 position and scrolls off-screen with the rest of the page,
    // creating a visible flicker mid-animation when the menu opens after
    // the user has scrolled. Locking the html element preserves the
    // sticky context while still preventing background scroll.
    // ------------------------------------------------------------------
    useEffect(() => {
        const previousOverflow = document.documentElement.style.overflow;

        if (isOpen) {
            document.documentElement.style.overflow = 'hidden';
            document.documentElement.setAttribute('data-mobile-menu-open', '');
            // Move focus to the close button for accessibility
            closeButtonRef.current?.focus();
        } else {
            document.documentElement.style.overflow = previousOverflow;
            document.documentElement.removeAttribute('data-mobile-menu-open');
        }

        return () => {
            document.documentElement.style.overflow = previousOverflow;
            document.documentElement.removeAttribute('data-mobile-menu-open');
        };
    }, [isOpen]);

    // ------------------------------------------------------------------
    // Close handler
    //
    // The account accordion (isAccountOpen) lives inside
    // MobileMenuAccountSection now — it collapses itself via its own `isOpen`
    // prop effect, so this handler only needs to close the overlay.
    // ------------------------------------------------------------------
    const handleClose = useCallback(() => {
        setIsOpen(false);
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
    // Inline-style fallback that guarantees the overlay is fixed-positioned
    // and hidden off-screen even when the CSS module fails to load. Astro's
    // ClientRouter occasionally re-renders the server-island parent without
    // re-injecting the module's <link> on back navigation (the CSS Module's
    // hashed class then matches no rule), which used to leave the menu's
    // raw content in the page flow and push the hero down. These inline
    // styles re-establish only the structural defaults so the overlay can
    // never break the layout; visual polish still comes from the CSS module.
    return (
        <div
            // biome-ignore lint/a11y/useSemanticElements: CSS-animated overlay; <dialog> open/close API would conflict with the slide-in animation
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.mobileMenu', 'Navigation menu')}
            aria-hidden={!isOpen}
            className={cn(styles.overlay, isOpen && styles.overlayOpen)}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9100,
                transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                pointerEvents: isOpen ? 'auto' : 'none'
            }}
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

            {/* Auth section — CTA link, user row + curated accordion, or guest sign-in */}
            <MobileMenuAccountSection
                locale={locale}
                t={t}
                isOpen={isOpen}
                user={user}
                ctaLabel={ctaLabel}
                ctaHref={ctaHref}
                curatedAccountItems={curatedAccountItems}
                signOutLabel={authTexts.signOut}
                signingOutLabel={authTexts.signingOut}
                isSigningOut={isSigningOut}
                onSignOut={() => void handleSignOut()}
                onClose={handleClose}
            />

            {/* Language + theme controls — shared primitives */}
            <div className={styles.preferencesSection}>
                <div className={styles.preferencesGroup}>
                    <span className={styles.preferencesLabel}>{t('nav.language', 'Idioma')}</span>
                    <LanguageSwitcher
                        locale={locale}
                        currentPath={currentPath}
                        variant="mobile"
                    />
                </div>
                <div className={styles.preferencesGroup}>
                    <span className={styles.preferencesLabel}>{t('nav.theme', 'Tema')}</span>
                    <ThemeControl
                        variant="mobile"
                        showLabels
                    />
                </div>
            </div>

            {/* Session zone: admin panel link (staff/host only, HOS-131 §6.5) */}
            {adminPanelItem && (
                <div className={styles.adminPanelSection}>
                    <a
                        href={adminPanelItem.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleClose}
                        tabIndex={isOpen ? 0 : -1}
                        className={styles.accountLink}
                    >
                        <adminPanelItem.icon
                            size={18}
                            aria-hidden="true"
                        />
                        {adminPanelItem.label}
                    </a>
                </div>
            )}

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
