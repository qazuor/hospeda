/**
 * @file MobileMenuAccountSection.client.tsx
 * @description Auth/account section of the mobile hamburguesa overlay —
 * extracted from `MobileMenu.client.tsx` (HOS-131 §6.5) to keep the parent
 * under the 500-line cap. Renders the "Publicar" three-way submenu
 * (HOS-691), the authenticated user row + expandable curated account
 * accordion (identity "Mi cuenta" link, Favoritos, ONE business shortcut,
 * Suscripción, sign-out), or the guest sign-in link. Shares
 * `MobileMenu.module.css` with its parent — this is a pure presentational
 * split, not a separately styled component.
 *
 * **HOS-691**: the single owner CTA link (which used to swap between the
 * `/publicar` funnel and a "Modo anfitrión" shortcut based on
 * `roles.includes('HOST')`) is replaced by a three-way "Publicar" submenu
 * offering accommodation, gastronomy, and experience — the same options the
 * desktop header's `PublishMenu.client.tsx` renders, sourced from the same
 * `PUBLISH_CTA_OPTIONS` (AC-38). It renders unconditionally, for every
 * visitor including an existing HOST or COMMERCE_OWNER (AC-12) — the old
 * host-mode shortcut to `/mi-cuenta/propiedades/` is gone; a HOST reaches
 * their properties list via the curated account accordion below instead.
 * A11y molde copied from `UserMenu.client.tsx` (`aria-haspopup="menu"`,
 * `aria-expanded`, `role="menu"`, click-outside dismissal) — NOT from
 * `SettingsDropdown.client.tsx`'s weaker ARIA.
 */

import { BuildingIcon, ChevronDownIcon, LogoutIcon } from '@repo/icons';
import type { MouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { LoadingButton } from '@/components/shared/feedback/LoadingButton';
import { PUBLISH_CTA_OPTIONS } from '@/config/discovery-doors';
import type { NavItem as AccountNavItem } from '@/config/navigation';
import { getInitials as getInitialsShared } from '@/lib/avatar-utils';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './MobileMenu.module.css';

/** Authenticated user data, as passed through from `MobileMenu.client.tsx`. */
interface MobileMenuAccountSectionUser {
    readonly name: string;
    readonly email: string;
    readonly image?: string;
}

/** Props for `MobileMenuAccountSection`. */
export interface MobileMenuAccountSectionProps {
    /** Active locale — used for the guest sign-in link and curated-item hrefs. */
    readonly locale: SupportedLocale;
    /** Translation function, already bound to `locale` by the parent. */
    readonly t: (key: string, fallback?: string) => string;
    /** Whether the parent overlay is open — controls `tabIndex` (focus trap) and collapses this accordion on close. */
    readonly isOpen: boolean;
    /** Authenticated user data (`null`/`undefined` when not logged in). */
    readonly user?: MobileMenuAccountSectionUser | null;
    /** The curated account nav items (HOS-131 §6.5 mobile "option A") — same selector as UserMenu's avatar dropdown. */
    readonly curatedAccountItems: readonly AccountNavItem[];
    /** Resolved "Cerrar sesión" label. */
    readonly signOutLabel: string;
    /** Resolved "Cerrando sesión…" loading label. */
    readonly signingOutLabel: string;
    /** Whether a sign-out request is in flight. */
    readonly isSigningOut: boolean;
    /** Sign-out click handler. */
    readonly onSignOut: () => void;
    /** Dedicated menu-link handler (may unwind history before navigating). */
    readonly onLinkClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Auth/account section — CTA link, user row + curated accordion, or guest
 * sign-in link. See the file JSDoc for why this is split out of
 * `MobileMenu.client.tsx`.
 */
export function MobileMenuAccountSection({
    locale,
    t,
    isOpen,
    user,
    curatedAccountItems,
    signOutLabel,
    signingOutLabel,
    isSigningOut,
    onSignOut,
    onLinkClick
}: MobileMenuAccountSectionProps) {
    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const [isPublishOpen, setIsPublishOpen] = useState(false);
    const publishTriggerRef = useRef<HTMLButtonElement>(null);
    const publishPanelRef = useRef<HTMLDivElement>(null);
    const publishTriggerLabel = t('nav.publishCta', 'Publicar');

    // Collapse both accordions whenever the parent overlay closes, mirroring
    // the previous single-component `handleClose` behavior (which reset
    // `isOpen` and the account accordion together).
    useEffect(() => {
        if (!isOpen) {
            setIsAccountOpen(false);
            setIsPublishOpen(false);
        }
    }, [isOpen]);

    // ── Publish submenu click-outside dismissal (copied from
    // UserMenu.client.tsx's a11y molde, HOS-691) ─────────────────────────
    useEffect(() => {
        if (!isPublishOpen) return;
        const handle = (event: globalThis.MouseEvent) => {
            const target = event.target as Node;
            if (
                publishPanelRef.current &&
                publishTriggerRef.current &&
                !publishPanelRef.current.contains(target) &&
                !publishTriggerRef.current.contains(target)
            ) {
                setIsPublishOpen(false);
            }
        };
        document.addEventListener('mousedown', handle);
        return () => {
            document.removeEventListener('mousedown', handle);
        };
    }, [isPublishOpen]);

    return (
        <div className={styles.authSection}>
            {/* "Publicar" submenu — three-way chooser (HOS-691 AC-12/AC-38),
                same PUBLISH_CTA_OPTIONS source as the desktop header's
                PublishMenu.client.tsx. Renders unconditionally, including
                for an existing HOST or COMMERCE_OWNER. */}
            <button
                ref={publishTriggerRef}
                type="button"
                onClick={() => setIsPublishOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isPublishOpen}
                tabIndex={isOpen ? 0 : -1}
                className={styles.ctaLink}
            >
                <BuildingIcon
                    size={18}
                    weight="regular"
                    aria-hidden="true"
                />
                {publishTriggerLabel}
                <span
                    aria-hidden="true"
                    className={cn(styles.userChevron, isPublishOpen && styles.userChevronOpen)}
                >
                    <ChevronDownIcon size={16} />
                </span>
            </button>

            {isPublishOpen && (
                <div
                    ref={publishPanelRef}
                    role="menu"
                    aria-label={publishTriggerLabel}
                    className={styles.accountLinks}
                >
                    {PUBLISH_CTA_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        return (
                            <a
                                key={option.id}
                                href={buildUrl({ locale, path: option.href })}
                                role="menuitem"
                                onClick={(event) => {
                                    setIsPublishOpen(false);
                                    onLinkClick(event);
                                }}
                                tabIndex={isOpen ? 0 : -1}
                                className={styles.accountLink}
                            >
                                <Icon
                                    size={18}
                                    aria-hidden="true"
                                />
                                {t(option.i18nKey)}
                            </a>
                        );
                    })}
                </div>
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
                                alt={user.name ?? 'Usuario'}
                                className={styles.userAvatar}
                            />
                        ) : (
                            <span
                                aria-hidden="true"
                                className={styles.userInitials}
                            >
                                {getInitialsShared({ name: user.name ?? '', placeholder: '' })}
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

                    {/* Expandable account links — curated set (HOS-131 §6.5),
                        same selector as UserMenu's avatar dropdown: identity
                        "Mi cuenta" link, Favoritos, ONE business shortcut,
                        Suscripción. */}
                    {isAccountOpen && (
                        <div className={styles.accountLinks}>
                            {curatedAccountItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <a
                                        key={item.id}
                                        href={buildUrl({ locale, path: item.href })}
                                        onClick={onLinkClick}
                                        tabIndex={isOpen ? 0 : -1}
                                        className={styles.accountLink}
                                    >
                                        <Icon
                                            size={18}
                                            aria-hidden="true"
                                        />
                                        {t(item.i18nKey)}
                                    </a>
                                );
                            })}
                            <LoadingButton
                                loading={isSigningOut}
                                loadingLabel={signingOutLabel}
                                onClick={onSignOut}
                                tabIndex={isOpen ? 0 : -1}
                                className={styles.signOutButton}
                            >
                                <LogoutIcon
                                    size={18}
                                    aria-hidden="true"
                                />
                                {signOutLabel}
                            </LoadingButton>
                        </div>
                    )}
                </>
            ) : (
                <a
                    href={`/${locale}/auth/signin/`}
                    onClick={onLinkClick}
                    tabIndex={isOpen ? 0 : -1}
                    className={styles.authButton}
                >
                    {t('nav.signIn')}
                </a>
            )}
        </div>
    );
}
