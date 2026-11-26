/**
 * @file MobileMenuAccountSection.client.tsx
 * @description Site-menu footer: publishing, then either one account-sheet
 * handoff row or the guest sign-in link. Account links and sign-out belong
 * exclusively to the shared account sheet (owner decision D2).
 *
 * **HOS-691**: the single owner CTA link (which used to swap between the
 * `/publicar` funnel and a "Modo anfitrión" shortcut based on
 * `roles.includes('HOST')`) is replaced by a three-way "Publicar" submenu
 * offering accommodation, venue, and experience — the same options the
 * desktop header's `PublishMenu.client.tsx` renders, sourced from the same
 * `PUBLISH_CTA_OPTIONS` (AC-38). It renders unconditionally, for every
 * visitor including an existing HOST or VENUE_OWNER (AC-12) — the old
 * host-mode shortcut to `/mi-cuenta/propiedades/` is gone; a HOST reaches
 * their properties list via the account sheet instead.
 * A11y molde copied from `UserMenu.client.tsx` (`aria-haspopup="menu"`,
 * `aria-expanded`, `role="menu"`, click-outside dismissal) — NOT from
 * `SettingsDropdown.client.tsx`'s weaker ARIA.
 */

import { BuildingIcon, ChevronDownIcon } from '@repo/icons';
import type { MouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { PlanBadge } from '@/components/shared/ui/PlanBadge';
import { PUBLISH_CTA_OPTIONS } from '@/config/discovery-doors';
import { getInitials as getInitialsShared } from '@/lib/avatar-utils';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './MobileMenu.module.css';
import { useTouristMenuPlan } from './use-tourist-menu-plan';

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
    /** Whether the parent overlay is open; controls tabIndex and the publishing submenu. */
    readonly isOpen: boolean;
    /** Authenticated user data (`null`/`undefined` when not logged in). */
    readonly user?: MobileMenuAccountSectionUser | null;
    /** Closes/unwinds the site menu before opening the header's account sheet. */
    readonly onOpenAccount: () => void;
    /** Dedicated menu-link handler (may unwind history before navigating). */
    readonly onLinkClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Auth/account section — publishing, account-sheet handoff, or guest
 * sign-in link. See the file JSDoc for why this is split out of
 * `MobileMenu.client.tsx`.
 */
export function MobileMenuAccountSection({
    locale,
    t,
    isOpen,
    user,
    onOpenAccount,
    onLinkClick
}: MobileMenuAccountSectionProps) {
    const [isPublishOpen, setIsPublishOpen] = useState(false);
    const plan = useTouristMenuPlan({ account: user?.email, open: isOpen });
    const publishTriggerRef = useRef<HTMLButtonElement>(null);
    const publishPanelRef = useRef<HTMLDivElement>(null);
    const publishTriggerLabel = t('nav.publishCta', 'Publicar');

    // Publishing must not remain expanded after the site menu closes.
    useEffect(() => {
        if (!isOpen) {
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
                for an existing HOST or VENUE_OWNER. */}
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
                    {/* One account-sheet handoff, never a second account menu. */}
                    <button
                        type="button"
                        onClick={onOpenAccount}
                        tabIndex={isOpen ? 0 : -1}
                        className={styles.userRow}
                        aria-haspopup="dialog"
                    >
                        {user.image ? (
                            <img
                                src={user.image}
                                alt=""
                                className={styles.userAvatar}
                            />
                        ) : (
                            <span
                                aria-hidden="true"
                                className={styles.userInitials}
                            >
                                {getInitialsShared({
                                    name: user.name,
                                    email: user.email,
                                    placeholder: '?'
                                })}
                            </span>
                        )}
                        <span className={styles.userName}>
                            {t('account.title')}
                            <small className={styles.userSecondary}>
                                {user.name || user.email}
                                <PlanBadge name={plan?.paid ? plan.name : null} />
                            </small>
                        </span>
                    </button>
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
