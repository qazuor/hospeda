/**
 * @file UserMenu.client.tsx
 * @description Header user menu — adapts to authentication state and role.
 *
 * Three render modes:
 *   - "guest": single "Iniciar sesión" link, used when no `initialUser` is passed.
 *   - "loading": avatar trigger with always-on items only, while `/auth/me` resolves.
 *   - "ready": full dropdown with permission-filtered items.
 *
 * The component refines authentication state on mount by hitting
 * `/api/v1/public/auth/me` (cached for 60s in sessionStorage). The fetch is
 * needed because middleware only parses the session on routes that explicitly
 * require it; SSG pages would otherwise see every visitor as a guest. Once the
 * fetch resolves the component:
 *   - Updates `<html data-user-authenticated>` so `GuestPreferenceNudge`
 *     stops or starts firing as needed.
 *   - Adds permission-gated items (Mis alojamientos, Panel de administración).
 *
 * Composes `LanguageSwitcher` and `ThemeControl` inside the dropdown so users
 * can change locale / theme without leaving the navbar. The same primitives
 * are used standalone in the navbar's right zone for guests, so the keyboard
 * and visual interaction stays consistent.
 */

import { LanguageSwitcher } from '@/components/shared/preferences/LanguageSwitcher.client';
import { ThemeControl } from '@/components/shared/preferences/ThemeControl.client';
import { signOut } from '@/lib/auth-client';
import { getInitials } from '@/lib/avatar-utils';
import { cn } from '@/lib/cn';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import {
    BuildingIcon,
    ChatIcon,
    ChevronDownIcon,
    CreditCardIcon,
    FavoriteIcon,
    type IconProps,
    LogoutIcon,
    SettingsIcon,
    ShieldIcon,
    StarIcon,
    UserIcon
} from '@repo/icons';
import type { ComponentType, JSX } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './UserMenu.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** User data passed in from server-rendered layout. */
export interface UserMenuUser {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly avatarUrl?: string;
}

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

interface MenuItem {
    readonly id: string;
    readonly label: string;
    readonly href: string;
    readonly icon: ComponentType<IconProps>;
    readonly external?: boolean;
    /**
     * Permission required to see this item. Items without a permission are
     * always shown to authenticated users.
     */
    readonly requiredPermission?: string;
    /** Render a divider above this item. */
    readonly separatorBefore?: boolean;
}

// ---------------------------------------------------------------------------
// Localized text
// ---------------------------------------------------------------------------

const TEXTS = {
    es: {
        signIn: 'Iniciar sesión',
        openMenu: 'Abrir menú de cuenta',
        signOut: 'Cerrar sesión',
        language: 'Idioma',
        theme: 'Tema',
        items: {
            dashboard: 'Mi cuenta',
            favorites: 'Mis favoritos',
            properties: 'Mis alojamientos',
            messages: 'Mis mensajes',
            reviews: 'Mis reseñas',
            subscription: 'Mi suscripción',
            preferences: 'Preferencias',
            adminPanel: 'Panel de administración'
        }
    },
    en: {
        signIn: 'Sign in',
        openMenu: 'Open account menu',
        signOut: 'Sign out',
        language: 'Language',
        theme: 'Theme',
        items: {
            dashboard: 'My account',
            favorites: 'My favorites',
            properties: 'My listings',
            messages: 'My messages',
            reviews: 'My reviews',
            subscription: 'My subscription',
            preferences: 'Preferences',
            adminPanel: 'Admin panel'
        }
    },
    pt: {
        signIn: 'Entrar',
        openMenu: 'Abrir menu da conta',
        signOut: 'Sair',
        language: 'Idioma',
        theme: 'Tema',
        items: {
            dashboard: 'Minha conta',
            favorites: 'Meus favoritos',
            properties: 'Meus imóveis',
            messages: 'Minhas mensagens',
            reviews: 'Minhas avaliações',
            subscription: 'Minha assinatura',
            preferences: 'Preferências',
            adminPanel: 'Painel de administração'
        }
    }
} as const;

// ---------------------------------------------------------------------------
// /auth/me fetch with sessionStorage cache
// ---------------------------------------------------------------------------

/**
 * sessionStorage key used by UserMenu to cache the `/auth/me` snapshot.
 * Exported so other modules (notably `refreshBetterAuthSession()` in
 * `lib/auth-client.ts`) can invalidate the cache after operations that
 * change the user record — e.g. submitting the SPEC-113 profile
 * completion form. Without invalidation, the UserMenu paints from the
 * stale snapshot for up to {@link AUTH_ME_CACHE_TTL_MS} after the change,
 * which is what made the navbar look empty after first-time profile
 * completion.
 */
export const AUTH_ME_CACHE_KEY = 'authMeSnapshot';
const AUTH_ME_CACHE_TTL_MS = 60 * 1000;

interface AuthMeSnapshot {
    readonly isAuthenticated: boolean;
    readonly user: UserMenuUser | null;
    readonly permissions: ReadonlyArray<string>;
    readonly cachedAt: number;
}

function readCachedAuthMe(): AuthMeSnapshot | null {
    try {
        const raw = sessionStorage.getItem(AUTH_ME_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as AuthMeSnapshot;
        if (Date.now() - parsed.cachedAt > AUTH_ME_CACHE_TTL_MS) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeCachedAuthMe(snapshot: AuthMeSnapshot): void {
    try {
        sessionStorage.setItem(AUTH_ME_CACHE_KEY, JSON.stringify(snapshot));
    } catch {
        // Quota exceeded or unavailable — ignore.
    }
}

async function fetchAuthMe(): Promise<AuthMeSnapshot> {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/v1/public/auth/me`, {
        credentials: 'include'
    });
    if (!response.ok) {
        return {
            isAuthenticated: false,
            user: null,
            permissions: [],
            cachedAt: Date.now()
        };
    }
    const json = (await response.json()) as {
        data?: {
            actor?: {
                id?: string;
                name?: string;
                email?: string;
                image?: string;
                permissions?: ReadonlyArray<string>;
            };
            isAuthenticated?: boolean;
        };
    };

    const actor = json.data?.actor;
    const isAuthenticated = json.data?.isAuthenticated === true;

    return {
        isAuthenticated,
        user:
            isAuthenticated && actor?.id
                ? {
                      id: actor.id,
                      name: actor.name ?? '',
                      email: actor.email ?? '',
                      // Map actor.image → avatarUrl so the navbar avatar
                      // stays in sync after the post-mount /auth/me refresh
                      // (otherwise OAuth users would flicker from the
                      // SSR-provided picture back to initials after ~1s,
                      // mirroring the name flicker fixed in PR #1111).
                      avatarUrl:
                          typeof actor.image === 'string' && actor.image.length > 0
                              ? actor.image
                              : undefined
                  }
                : null,
        permissions: actor?.permissions ?? [],
        cachedAt: Date.now()
    };
}

// ---------------------------------------------------------------------------
// Menu item registry
// ---------------------------------------------------------------------------

function buildMenuItems({
    texts,
    locale,
    adminPanelUrl
}: {
    readonly texts: (typeof TEXTS)[keyof typeof TEXTS];
    readonly locale: SupportedLocale;
    readonly adminPanelUrl: string | undefined;
}): ReadonlyArray<MenuItem> {
    return [
        {
            id: 'dashboard',
            label: texts.items.dashboard,
            href: buildUrl({ locale, path: 'mi-cuenta' }),
            icon: UserIcon
        },
        {
            id: 'favorites',
            label: texts.items.favorites,
            href: buildUrl({ locale, path: 'mi-cuenta/favoritos' }),
            icon: FavoriteIcon
        },
        {
            id: 'properties',
            label: texts.items.properties,
            href: buildUrl({ locale, path: 'mi-cuenta/propiedades' }),
            icon: BuildingIcon,
            requiredPermission: 'accommodation.create'
        },
        {
            id: 'messages',
            label: texts.items.messages,
            href: buildUrl({ locale, path: 'mi-cuenta/consultas' }),
            icon: ChatIcon
        },
        {
            id: 'reviews',
            label: texts.items.reviews,
            href: buildUrl({ locale, path: 'mi-cuenta/resenas' }),
            icon: StarIcon
        },
        {
            id: 'subscription',
            label: texts.items.subscription,
            href: buildUrl({ locale, path: 'mi-cuenta/suscripcion' }),
            icon: CreditCardIcon
        },
        {
            id: 'preferences',
            label: texts.items.preferences,
            href: buildUrl({ locale, path: 'mi-cuenta/preferencias' }),
            icon: SettingsIcon
        },
        ...(adminPanelUrl
            ? ([
                  {
                      id: 'admin-panel',
                      label: texts.items.adminPanel,
                      href: adminPanelUrl,
                      icon: ShieldIcon,
                      external: true,
                      requiredPermission: 'access.panelAdmin',
                      separatorBefore: true
                  }
              ] as const)
            : [])
    ];
}

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
    const [user, setUser] = useState<UserMenuUser | null>(initialUser);
    const [permissions, setPermissions] = useState<ReadonlyArray<string> | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const texts = TEXTS[locale] ?? TEXTS.es;

    // ── Refine auth state from /auth/me on mount ────────────────────────
    // Stale-while-revalidate: paint from cache instantly (if any) for perceived
    // perf, but ALWAYS hit /auth/me in background to detect post-OAuth state
    // changes that would otherwise be masked by a 60s-TTL cache poisoned with
    // the pre-signin guest snapshot. See SPEC-103 T-093.
    useEffect(() => {
        let cancelled = false;
        const cached = readCachedAuthMe();
        if (cached) {
            setUser(cached.user);
            setPermissions(cached.permissions);
            document.documentElement.setAttribute(
                'data-user-authenticated',
                cached.isAuthenticated ? 'true' : 'false'
            );
        }

        fetchAuthMe()
            .then((snapshot) => {
                if (cancelled) return;
                writeCachedAuthMe(snapshot);
                setUser(snapshot.user);
                setPermissions(snapshot.permissions);
                document.documentElement.setAttribute(
                    'data-user-authenticated',
                    snapshot.isAuthenticated ? 'true' : 'false'
                );
            })
            .catch(() => {
                // Network error — keep whatever the cache or server-rendered
                // initialUser hint already gave us.
                if (!cancelled && !cached) setPermissions([]);
            });

        return () => {
            cancelled = true;
        };
    }, []);

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
            await signOut();
        } finally {
            window.location.href = buildUrl({ locale, path: '/' });
        }
    }, [locale]);

    // ── Item filtering ──────────────────────────────────────────────────
    const visibleItems = useMemo(() => {
        const all = buildMenuItems({ texts, locale, adminPanelUrl });
        return all.filter((item) => {
            if (!item.requiredPermission) return true;
            // While permissions are loading, hide gated items so we don't flash items the user can't actually use.
            if (permissions === null) return false;
            return permissions.includes(item.requiredPermission);
        });
    }, [texts, locale, adminPanelUrl, permissions]);

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
    const initials = getInitials({ name: user.name, placeholder: '?' });

    return (
        <div className={styles.wrapper}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-label={`${texts.openMenu}: ${user.name}`}
                className={cn(
                    styles.trigger,
                    variant === 'hero' ? styles.triggerHero : styles.triggerScrolled
                )}
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
                <span className={styles.displayName}>{user.name}</span>
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
                    className={styles.menu}
                >
                    {/* Header */}
                    <div className={styles.menuHeader}>
                        <p className={styles.menuHeaderName}>{user.name}</p>
                        <p className={styles.menuHeaderEmail}>{user.email}</p>
                    </div>

                    {/* Navigation items */}
                    <ul className={styles.menuList}>
                        {visibleItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <li key={item.id}>
                                    {item.separatorBefore && <hr className={styles.divider} />}
                                    <a
                                        href={item.href}
                                        role="menuitem"
                                        target={item.external ? '_blank' : undefined}
                                        rel={item.external ? 'noopener noreferrer' : undefined}
                                        onClick={() => setIsOpen(false)}
                                        className={styles.menuLink}
                                    >
                                        <Icon
                                            size={18}
                                            weight="regular"
                                            aria-hidden="true"
                                        />
                                        <span>{item.label}</span>
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

                    <hr className={styles.divider} />

                    {/* Sign out */}
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
