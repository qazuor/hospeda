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
 * Auth state (user, permissions) resolves the SAME way UserMenu's does:
 * `useAccountPermissions` (`@/hooks/use-account-permissions`) in
 * SSR-reconciling mode, seeded from `initialUser`/`initialRoles` (the SSR
 * hint from `Astro.locals.user`, forwarded through `MobileMenuIsland.astro`
 * — `null` on pages whose middleware didn't parse the session) and refined
 * client-side from the shared `authMeSnapshot` cache / `/auth/me` fetch.
 * This island no longer runs inside a `server:defer` Server Island (see
 * `MobileMenuIsland.astro`'s file doc for why), so it can never assume a
 * freshly-parsed session.
 *
 * **HOS-691**: the former host-mode CTA (`isHostMode`/`ctaLabel`/`ctaHref`,
 * derived from `roles.includes('HOST')`) is gone. The owner CTA is now the
 * unconditional three-way "Publicar" submenu rendered inside
 * `MobileMenuAccountSection` (accommodation / gastronomy / experience,
 * sourced from `PUBLISH_CTA_OPTIONS` — see that file's JSDoc), so this
 * component no longer needs the resolved `roles` set at all.
 *
 * Tasks: T-074, HOS-311, HOS-691
 */

import { CloseIcon } from '@repo/icons';
import type { MouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageSwitcher } from '@/components/shared/preferences/LanguageSwitcher.client';
import { ThemeControl } from '@/components/shared/preferences/ThemeControl.client';
import { IconButton } from '@/components/ui/IconButtonReact';
import type { NavItem as AccountNavItem } from '@/config/navigation';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { buildAdminPanelItem } from '@/lib/admin-panel-link';
import type { AuthMeUser } from '@/lib/auth-cache';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/cn';
import { acquireDialogHistoryEntry } from '@/lib/dialog-history';
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
    /**
     * SSR auth hint (`Astro.locals.user`, mapped to `AuthMeUser`), `null`
     * for guests AND for pages whose middleware didn't parse the session.
     * Reconciled against the shared client cache via `useAccountPermissions`
     * — see the file JSDoc.
     */
    readonly initialUser: AuthMeUser | null;
    /**
     * SSR role-set hint (`Astro.locals.user?.roles`), for the host-mode CTA on
     * first paint. Empty on pages whose middleware did not parse the session.
     */
    readonly initialRoles: readonly string[];
    /**
     * Admin panel base URL for the session-zone admin-panel link (HOS-131
     * §6.5, staff only in practice, gated by `access.panelAdmin`).
     * `undefined` (env var not configured) hides it. Deliberately NOT used
     * by the owner CTA any more — see HOS-311 in the body.
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
    initialUser,
    initialRoles,
    adminPanelUrl
}: MobileMenuProps) {
    const { t } = createTranslations(locale);
    const [isOpen, setIsOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const historyReleaseRef = useRef<(() => void) | null>(null);
    const authTexts = AUTH_TEXTS[locale] ?? AUTH_TEXTS.es;

    // ------------------------------------------------------------------
    // Resolve auth state (user, permissions) for the whole auth section —
    // curated account block and admin-panel session link. SSR-reconciling
    // mode (same as UserMenu.client.tsx): `initialUser`/`initialRoles` seed
    // first paint, the shared `authMeSnapshot` cache / `/auth/me` fetch
    // refines it on hydration. Never a second auth mechanism — see the file
    // JSDoc.
    //
    // HOS-691: `roles` is no longer read here. The former host-mode CTA
    // (`roles.includes('HOST')` swapping the owner CTA's label/href) is
    // replaced by the unconditional three-way "Publicar" submenu inside
    // `MobileMenuAccountSection` — see that file's JSDoc.
    // ------------------------------------------------------------------
    // `syncAuthenticatedAttribute: false` — UserMenu (client:load, mounted
    // on every page) is the single owner of `<html data-user-authenticated>`;
    // this island must not become a second writer of the same attribute.
    const { user, permissions } = useAccountPermissions({
        initialUser,
        initialRoles,
        syncAuthenticatedAttribute: false
    });

    // ------------------------------------------------------------------
    // Map the resolved AuthMeUser (id/name/email/avatarUrl) to the shape
    // MobileMenuAccountSection expects (name/email/image) — a pure
    // presentational adapter, not a second auth source.
    // ------------------------------------------------------------------
    const accountSectionUser = user
        ? { name: user.name, email: user.email, image: user.avatarUrl }
        : null;

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
    // UserMenu.client.tsx. Naturally stays null for guests too, since a
    // guest's resolved `permissions` is `[]`.
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
    // Dedicated back-button handling for the mobile menu.
    //
    // The shared dialog hook is correct for local modal surfaces, but the
    // mobile menu's primary action is real navigation. When its generic
    // release/unwind raced a genuine menu-link navigation, production mobile
    // Chrome got stuck in an endless loading state. Keep the "first back
    // closes the menu" affordance, but own the history entry here so a menu
    // link can unwind first and only then continue navigation.
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!isOpen) return;

        const { release } = acquireDialogHistoryEntry({
            onPopped: () => setIsOpen(false)
        });
        historyReleaseRef.current = release;

        return () => {
            if (historyReleaseRef.current === release) {
                historyReleaseRef.current = null;
                release();
            }
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

    const continueNavigation = useCallback(async (href: string) => {
        try {
            const { navigate } = await import('astro:transitions/client');
            await navigate(href);
        } catch {
            window.location.assign(href);
        }
    }, []);

    const handleLinkClick = useCallback(
        (event: MouseEvent<HTMLAnchorElement>) => {
            const anchor = event.currentTarget;
            const href = anchor.href;

            if (
                !isOpen ||
                href.length === 0 ||
                anchor.target === '_blank' ||
                anchor.origin !== window.location.origin
            ) {
                handleClose();
                return;
            }

            event.preventDefault();
            setIsOpen(false);

            let settled = false;
            const finishNavigation = () => {
                if (settled) return;
                settled = true;
                window.removeEventListener('popstate', handlePopState);
                window.clearTimeout(timeoutId);
                void continueNavigation(href);
            };

            const handlePopState = () => {
                finishNavigation();
            };

            window.addEventListener('popstate', handlePopState, { once: true });
            const timeoutId = window.setTimeout(finishNavigation, 160);

            const release = historyReleaseRef.current;
            historyReleaseRef.current = null;
            release?.();
        },
        [continueNavigation, handleClose, isOpen]
    );

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
    // ClientRouter has occasionally re-rendered this island without
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
                    onClick={handleLinkClick}
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
                                onClick={handleLinkClick}
                                tabIndex={isOpen ? 0 : -1}
                                className={styles.navLink}
                            >
                                {item.label}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Auth section — Publicar submenu, user row + curated accordion, or guest sign-in */}
            <MobileMenuAccountSection
                locale={locale}
                t={t}
                isOpen={isOpen}
                user={accountSectionUser}
                curatedAccountItems={curatedAccountItems}
                signOutLabel={authTexts.signOut}
                signingOutLabel={authTexts.signingOut}
                isSigningOut={isSigningOut}
                onSignOut={() => void handleSignOut()}
                onLinkClick={handleLinkClick}
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
                        onClick={handleLinkClick}
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
        </div>
    );
}
