/**
 * @file MobileMenuAccountSection.client.tsx
 * @description Auth/account section of the mobile hamburguesa overlay —
 * extracted from `MobileMenu.client.tsx` (HOS-131 §6.5) to keep the parent
 * under the 500-line cap. Renders the owner CTA link, the authenticated
 * user row + expandable curated account accordion (identity "Mi cuenta"
 * link, Favoritos, ONE business shortcut, Suscripción, sign-out), or the
 * guest sign-in link. Shares `MobileMenu.module.css` with its parent —
 * this is a pure presentational split, not a separately styled component.
 */

import { BuildingIcon, ChevronDownIcon, LogoutIcon } from '@repo/icons';
import { useEffect, useState } from 'react';
import { LoadingButton } from '@/components/shared/feedback/LoadingButton';
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
    /** Label for the owner CTA button. */
    readonly ctaLabel?: string;
    /** Destination href for the owner CTA button. */
    readonly ctaHref?: string;
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
    /** Called on any link click (closes the whole overlay). */
    readonly onClose: () => void;
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
    ctaLabel,
    ctaHref,
    curatedAccountItems,
    signOutLabel,
    signingOutLabel,
    isSigningOut,
    onSignOut,
    onClose
}: MobileMenuAccountSectionProps) {
    const [isAccountOpen, setIsAccountOpen] = useState(false);

    // Collapse the accordion whenever the parent overlay closes, mirroring
    // the previous single-component `handleClose` behavior (which reset
    // both `isOpen` and `isAccountOpen` together).
    useEffect(() => {
        if (!isOpen) setIsAccountOpen(false);
    }, [isOpen]);

    return (
        <div className={styles.authSection}>
            {ctaLabel && ctaHref && (
                <a
                    href={ctaHref}
                    onClick={onClose}
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
                                        onClick={onClose}
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
                    onClick={onClose}
                    tabIndex={isOpen ? 0 : -1}
                    className={styles.authButton}
                >
                    {t('nav.signIn', 'Iniciar sesión')}
                </a>
            )}
        </div>
    );
}
