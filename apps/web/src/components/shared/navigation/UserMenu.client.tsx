/**
 * @file UserMenu.client.tsx
 * @description Header user menu — adapts to authentication state and role.
 *
 * Three render modes:
 *   - "guest": single "Iniciar sesión" link, used when no `initialUser` is passed.
 *   - "loading": avatar trigger with always-on items only, while `/auth/me` resolves.
 *   - "ready": full dropdown with permission-filtered items.
 *
 * The component refines authentication state on mount via
 * `useAccountPermissions` (`@/hooks/use-account-permissions`), which hits
 * `/api/v1/public/auth/me` (cached for 60s in sessionStorage, via
 * `@/lib/auth-cache`) — SSR-reconciling mode, since this is the component
 * responsible for `<html data-user-authenticated>` (consumed by
 * `GuestPreferenceNudge`). The fetch is needed because middleware only
 * parses the session on routes that explicitly require it; SSG pages would
 * otherwise see every visitor as a guest.
 *
 * Nav items (identity "Mi cuenta" link + shortcuts: Favoritos, ONE
 * business-panel shortcut, Suscripción) are the curated set from
 * `ACCOUNT_NAV_GROUPS` / `getCuratedAccountNav` (HOS-131 §6.4) — this
 * component is NOT the source of truth for those items, it only resolves
 * `dashboardItem`/`shortcutItems` and renders them. The admin-panel session
 * link is built by the shared `buildAdminPanelItem` (`@/lib/admin-panel-link`,
 * also used by `MobileMenu.client.tsx`'s session zone).
 *
 * Composes `LanguageSwitcher` and `ThemeControl` inside the dropdown so users
 * can change locale / theme without leaving the navbar. The same primitives
 * are used standalone in the navbar's right zone for guests, so the keyboard
 * and visual interaction stays consistent.
 */

import { ChevronDownIcon, LogoutIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageSwitcher } from '@/components/shared/preferences/LanguageSwitcher.client';
import { ThemeControl } from '@/components/shared/preferences/ThemeControl.client';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { buildAdminPanelItem, STAFF_DISCRIMINATOR_PERMISSION } from '@/lib/admin-panel-link';
import { syncPlanPersonProperties } from '@/lib/analytics/plan-properties';
import { identifyUser, resetUser, setPersonProperties } from '@/lib/analytics/posthog-client';
import { AUTH_ME_CACHE_KEY, type AuthMeUser } from '@/lib/auth-cache';
import { signOut } from '@/lib/auth-client';
import { getInitials } from '@/lib/avatar-utils';
import { cn } from '@/lib/cn';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { getCuratedAccountNav } from '@/lib/nav-avatar';
import { buildUrl } from '@/lib/urls';
import styles from './UserMenu.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** User data passed in from server-rendered layout. */
export type UserMenuUser = AuthMeUser;

/** Visual variant matching the navbar scroll state. */
export type UserMenuVariant = 'hero' | 'scrolled';

export interface UserMenuProps {
    /**
     * Initial user data from server. Pass `null` for guest visitors.
     * The component still hits `/auth/me` on mount to refine permissions
     * (and to handle SSG pages where middleware doesn't parse the session).
     */
    readonly initialUser: UserMenuUser | null;
    /** Current locale, used for localized links and i18n. */
    readonly locale: SupportedLocale;
    /** Current page pathname so language swap preserves the page. */
    readonly currentPath: string;
    /** Visual variant matching the navbar's scroll state. Defaults to "scrolled". */
    readonly variant?: UserMenuVariant;
    /**
     * Admin panel base URL for the "Panel de administración" link.
     * When undefined (env var not configured), the admin link is hidden.
     */
    readonly adminPanelUrl: string | undefined;
}

// ---------------------------------------------------------------------------
// Localized text (session zone only — nav items resolve via t(item.i18nKey))
// ---------------------------------------------------------------------------

const TEXTS = {
    es: {
        signIn: 'Iniciar sesión',
        openMenu: 'Abrir menú de cuenta',
        signOut: 'Cerrar sesión',
        language: 'Idioma',
        theme: 'Tema'
    },
    en: {
        signIn: 'Sign in',
        openMenu: 'Open account menu',
        signOut: 'Sign out',
        language: 'Language',
        theme: 'Theme'
    },
    pt: {
        signIn: 'Entrar',
        openMenu: 'Abrir menu da conta',
        signOut: 'Sair',
        language: 'Idioma',
        theme: 'Tema'
    }
} as const;

/**
 * Permission that marks a user as a host (owner of accommodations). Fed to
 * PostHog as the `is_host` person property so funnels can segment hosts vs
 * pure tourists.
 */
const HOST_PERMISSION = 'accommodation.create' as const;

/**
 * Permission that marks a user as a commerce listing owner (gastronomy /
 * experience self-service, SPEC-253). Fed to PostHog as `is_commerce_owner`.
 */
const COMMERCE_OWNER_PERMISSION = 'commerce.editOwn' as const;

/**
 * Re-exported from `@/lib/auth-cache` so existing importers of
 * `AUTH_ME_CACHE_KEY` from this module keep working without churn.
 * The canonical declaration lives in the shared module — see the JSDoc there.
 */
export { AUTH_ME_CACHE_KEY };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * UserMenu - header dropdown that adapts to auth state and role.
 *
 * @example
 * ```astro
 * <UserMenu
 *   client:load
 *   initialUser={userMenuUser}
 *   locale={locale}
 *   currentPath={Astro.url.pathname}
 *   variant="hero"
 *   adminPanelUrl={getAdminUrl()}
 * />
 * ```
 */
export function UserMenu({
    initialUser,
    locale,
    currentPath,
    variant = 'scrolled',
    adminPanelUrl
}: UserMenuProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const texts = TEXTS[locale] ?? TEXTS.es;
    const { t } = createTranslations(locale);

    // SSR-reconciling mode (see the hook's JSDoc) — this is the component
    // responsible for the `data-user-authenticated` attribute.
    const { user, permissions, role } = useAccountPermissions({ initialUser });

    // ── PostHog identify ─────────────────────────────────────────────────
    // Fires whenever `user` resolves to a known, authenticated id (from the
    // SSR-provided `initialUser`, the sessionStorage cache, or the /auth/me
    // fetch above). UserMenu is mounted on every page (`client:load`), so
    // this is the single place that reliably knows the current visitor's id
    // client-side. Idempotent — safe to call again with the same id on every
    // remount (soft nav). The counterpart `resetUser()` call lives in
    // `handleSignOut` below, not here, so a guest page load never resets an
    // anonymous visitor's distinct id.
    //
    // Person properties (role + segment flags) are attached once `permissions`
    // resolve. On first mount `permissions` is null (SSR gave us the user id
    // but not the permission set), so the initial identify carries the id
    // alone; a second identify with the enriched props fires when /auth/me (or
    // the cache) lands. PostHog merges person properties across identify calls,
    // so segmenting funnels by is_host / is_commerce_owner / is_staff works
    // without re-sending the id-only call.
    useEffect(() => {
        if (!user) return;
        const props =
            permissions === null
                ? undefined
                : {
                      role,
                      is_host: permissions.includes(HOST_PERMISSION),
                      is_commerce_owner: permissions.includes(COMMERCE_OWNER_PERMISSION),
                      is_staff: permissions.includes(STAFF_DISCRIMINATOR_PERMISSION)
                  };
        identifyUser(user.id, props);
    }, [user, permissions, role]);

    // ── PostHog plan/tier person property ────────────────────────────────
    // Resolved from the PROTECTED entitlements endpoint (NOT /auth/me, which
    // must stay a cheap public hot path), client-side and non-blocking, once
    // the visitor is known. Guarded to run at most once per page load.
    useEffect(() => {
        if (!user) return;
        void syncPlanPersonProperties({ apiUrl: getApiUrl() });
    }, [user]);

    // ── PostHog locale person property ───────────────────────────────────
    // The active locale is already known client-side, so this is free (no
    // server hit) and updates if the user switches language mid-session.
    useEffect(() => {
        if (!user) return;
        setPersonProperties({ locale });
    }, [user, locale]);

    // ── Click-outside dismissal ─────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        const handle = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                menuRef.current &&
                triggerRef.current &&
                !menuRef.current.contains(target) &&
                !triggerRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handle);
        return () => {
            document.removeEventListener('mousedown', handle);
        };
    }, [isOpen]);

    // ── ESC key dismissal ───────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        const handle = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handle);
        return () => {
            document.removeEventListener('keydown', handle);
        };
    }, [isOpen]);

    // ── Sign out handler ────────────────────────────────────────────────
    const handleSignOut = useCallback(async () => {
        setIsOpen(false);
        try {
            sessionStorage.removeItem(AUTH_ME_CACHE_KEY);
            resetUser();
            await signOut();
        } finally {
            window.location.href = buildUrl({ locale, path: '/' });
        }
    }, [locale]);

    // ── Curated nav (identity + shortcuts, HOS-131 §6.4) ─────────────────
    // Fail-closed while permissions are loading: `permissions ?? []` hides
    // the gated business shortcut until the real list resolves. `dashboard`,
    // `favorites`, and `subscription` have no `requiredPermission`, so they
    // stay visible for any authenticated user regardless of loading state.
    const avatarNav = useMemo(
        () => getCuratedAccountNav({ permissions: permissions ?? [] }),
        [permissions]
    );

    // ── Admin panel session item ──────────────────────────────────────────
    const adminPanelItem = useMemo(() => {
        // While permissions are loading, hide rather than flash the link.
        if (permissions === null) return null;
        return buildAdminPanelItem({ locale, adminPanelUrl, permissions });
    }, [locale, adminPanelUrl, permissions]);

    // ── Render: guest ──────────────────────────────────────────────────
    if (!user) {
        return (
            <a
                href={buildUrl({ locale, path: 'auth/signin' })}
                className={cn(
                    styles.signInLink,
                    variant === 'hero' ? styles.signInLinkHero : styles.signInLinkScrolled
                )}
            >
                {texts.signIn}
            </a>
        );
    }

    // ── Render: authenticated ──────────────────────────────────────────
    // Fall back to email when the user has no name/displayName set so the
    // trigger label and dropdown header never render empty.
    const displayName = user.name.trim().length > 0 ? user.name : user.email;
    const initials = getInitials({ name: user.name, email: user.email, placeholder: '?' });
    const showEmailLine = displayName !== user.email;

    return (
        <div className={styles.wrapper}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-label={`${texts.openMenu}: ${displayName}`}
                className={cn(
                    styles.trigger,
                    variant === 'hero' ? styles.triggerHero : styles.triggerScrolled
                )}
            >
                {user.avatarUrl ? (
                    <img
                        src={user.avatarUrl}
                        alt={displayName}
                        width={28}
                        height={28}
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
                <span className={styles.displayName}>{displayName}</span>
                <span
                    aria-hidden="true"
                    className={cn(styles.chevron, isOpen && styles.chevronOpen)}
                >
                    <ChevronDownIcon size={14} />
                </span>
            </button>

            {isOpen && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label={texts.openMenu}
                    className={cn(styles.menu, 'overlay-surface')}
                >
                    {/* Identity zone: name/email + "Mi cuenta" link */}
                    <div className={styles.menuHeader}>
                        <p className={styles.menuHeaderName}>{displayName}</p>
                        {showEmailLine && <p className={styles.menuHeaderEmail}>{user.email}</p>}
                        {avatarNav.dashboardItem && (
                            <a
                                href={buildUrl({ locale, path: avatarNav.dashboardItem.href })}
                                role="menuitem"
                                onClick={() => setIsOpen(false)}
                                className={styles.menuHeaderAccountLink}
                            >
                                {t(avatarNav.dashboardItem.i18nKey)}
                            </a>
                        )}
                    </div>

                    {/* Shortcuts zone: Favoritos, business shortcut, Suscripción */}
                    <ul className={styles.menuList}>
                        {avatarNav.shortcutItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <li key={item.id}>
                                    <a
                                        href={buildUrl({ locale, path: item.href })}
                                        role="menuitem"
                                        onClick={() => setIsOpen(false)}
                                        className={styles.menuLink}
                                    >
                                        <Icon
                                            size={18}
                                            weight="regular"
                                            aria-hidden="true"
                                        />
                                        <span>{t(item.i18nKey)}</span>
                                    </a>
                                </li>
                            );
                        })}
                    </ul>

                    <hr className={styles.divider} />

                    {/* Inline preferences */}
                    <div className={styles.prefsSection}>
                        <div className={styles.prefsRow}>
                            <span className={styles.prefsLabel}>{texts.language}</span>
                            <LanguageSwitcher
                                locale={locale}
                                currentPath={currentPath}
                                variant="menu"
                            />
                        </div>
                        <div className={styles.prefsRow}>
                            <span className={styles.prefsLabel}>{texts.theme}</span>
                            <ThemeControl
                                variant="menu"
                                showLabels={false}
                            />
                        </div>
                    </div>

                    {/* Session zone: admin panel link + sign out */}
                    {adminPanelItem && (
                        <>
                            <hr className={styles.divider} />
                            <a
                                href={adminPanelItem.href}
                                role="menuitem"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setIsOpen(false)}
                                className={styles.menuLink}
                            >
                                <adminPanelItem.icon
                                    size={18}
                                    weight="regular"
                                    aria-hidden="true"
                                />
                                <span>{adminPanelItem.label}</span>
                            </a>
                        </>
                    )}

                    <hr className={styles.divider} />

                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => void handleSignOut()}
                        className={styles.signOutButton}
                    >
                        <LogoutIcon
                            size={18}
                            weight="regular"
                            aria-hidden="true"
                        />
                        <span>{texts.signOut}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
