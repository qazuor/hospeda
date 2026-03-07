import { ChevronDownIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { signOut } from '../../lib/auth-client';
import type { SupportedLocale } from '../../lib/i18n';
import { buildUrl } from '../../lib/urls';

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
    /** Current locale for building account links */
    readonly locale?: string;
    /**
     * Visual variant that mirrors the navbar's scroll state.
     * - "hero": transparent navbar (white text on dark overlay)
     * - "scrolled": opaque navbar (dark text on light background)
     */
    readonly variant?: 'hero' | 'scrolled';
}

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

/**
 * UserNav - interactive user menu island for the Navbar.
 *
 * Renders a compact button (avatar or initials + name) that opens a dropdown
 * with account links and a sign-out action. Closes on Escape, click-outside,
 * and after navigation link clicks.
 *
 * Visual variant is controlled by the parent Navbar via the `variant` prop so
 * the button colours always stay consistent with the current scroll state.
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
    // Track the scroll-based visual variant so the button colours match the
    // navbar's current state (transparent hero vs. opaque scrolled).
    const [activeVariant, setActiveVariant] = useState<'hero' | 'scrolled'>(initialVariant);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const initials = getInitials({ name: user.name });

    // Listen for the custom scroll-state event dispatched by Navbar.astro's
    // inline <script> so the button classes stay in sync with the navbar.
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

    // Close on click outside
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
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                buttonRef.current?.focus();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const handleSignOut = useCallback(async () => {
        setIsOpen(false);
        try {
            await signOut();
        } finally {
            window.location.reload();
        }
    }, []);

    // Button classes mirror the static sign-in button in Navbar, reactive to scroll state.
    const buttonClasses =
        activeVariant === 'scrolled'
            ? 'inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors border border-foreground/20 text-foreground bg-transparent hover:bg-foreground/5'
            : 'inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors border border-hero-border text-hero-text bg-hero-surface hover:bg-hero-surface';

    return (
        <div className="relative inline-block">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-label={`Menu de usuario para ${user.name}`}
                className={buttonClasses}
            >
                {/* Avatar or initials circle */}
                {user.avatarUrl ? (
                    <img
                        src={user.avatarUrl}
                        alt=""
                        aria-hidden="true"
                        className="h-6 w-6 rounded-full object-cover"
                    />
                ) : (
                    <span
                        aria-hidden="true"
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground text-xs"
                    >
                        {initials}
                    </span>
                )}

                {/* Display name - hidden on very small screens */}
                <span className="hidden max-w-[8rem] truncate sm:inline">{user.name}</span>

                {/* Chevron */}
                <span
                    aria-hidden="true"
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                >
                    <ChevronDownIcon size={14} />
                </span>
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label="Menu de cuenta de usuario"
                    className="absolute top-full right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-card py-2 shadow-lg"
                >
                    {/* User info header */}
                    <div className="border-border border-b px-4 py-3">
                        <p className="truncate font-semibold text-foreground text-sm">
                            {user.name}
                        </p>
                        <p className="truncate text-foreground/60 text-xs">{user.email}</p>
                    </div>

                    {/* Account links */}
                    <div className="py-1">
                        <a
                            href={buildUrl({
                                locale: locale as SupportedLocale,
                                path: 'mi-cuenta'
                            })}
                            role="menuitem"
                            onClick={() => setIsOpen(false)}
                            className="block px-4 py-2 text-foreground/80 text-sm transition-colors hover:bg-foreground/5"
                        >
                            Mi cuenta
                        </a>
                        <a
                            href={buildUrl({
                                locale: locale as SupportedLocale,
                                path: 'mi-cuenta/favoritos'
                            })}
                            role="menuitem"
                            onClick={() => setIsOpen(false)}
                            className="block px-4 py-2 text-foreground/80 text-sm transition-colors hover:bg-foreground/5"
                        >
                            Favoritos
                        </a>
                        <a
                            href={buildUrl({
                                locale: locale as SupportedLocale,
                                path: 'mi-cuenta/resenas'
                            })}
                            role="menuitem"
                            onClick={() => setIsOpen(false)}
                            className="block px-4 py-2 text-foreground/80 text-sm transition-colors hover:bg-foreground/5"
                        >
                            Mis resenas
                        </a>
                        <a
                            href={buildUrl({
                                locale: locale as SupportedLocale,
                                path: 'mi-cuenta/preferencias'
                            })}
                            role="menuitem"
                            onClick={() => setIsOpen(false)}
                            className="block px-4 py-2 text-foreground/80 text-sm transition-colors hover:bg-foreground/5"
                        >
                            Preferencias
                        </a>
                    </div>

                    <hr className="my-1 border-border" />

                    {/* Sign out */}
                    <div className="py-1">
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => void handleSignOut()}
                            className="block w-full px-4 py-2 text-left text-destructive text-sm transition-colors hover:bg-destructive/10"
                        >
                            Cerrar sesion
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
