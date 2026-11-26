import { BuildingIcon, ChevronRightIcon, LogoutIcon } from '@repo/icons';
import type { MouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { PlanBadge } from '@/components/shared/ui/PlanBadge';
import { PUBLISH_CTA_OPTIONS } from '@/config/discovery-doors';
import { getAvatarDisplayName, getInitials } from '@/lib/avatar-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { getCuratedAccountNav } from '@/lib/nav-avatar';
import { signOutFromNavigation } from '@/lib/navigation/sign-out';
import { buildUrl } from '@/lib/urls';
import styles from './MobileMenu.module.css';
import { useTouristMenuPlan } from './use-tourist-menu-plan';

interface Props {
    readonly locale: SupportedLocale;
    readonly t: (key: string) => string;
    readonly isOpen: boolean;
    readonly user: {
        readonly name: string;
        readonly email: string;
        readonly image?: string;
    } | null;
    readonly permissions: Parameters<typeof getCuratedAccountNav>[0]['permissions'];
    readonly closeThen: (options: { readonly afterClose: () => void }) => void;
    readonly onLinkClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Renders publishing destinations and, per owner decision D05, the desktop
 * dropdown's account shortcuts and sign-out directly in the mobile menu.
 * The tourist plan line (HOS-2649) loads lazily while the menu is open.
 */
export function MobileMenuAccountSection({
    locale,
    t,
    isOpen,
    user,
    permissions,
    closeThen,
    onLinkClick
}: Props) {
    const tabIndex = isOpen ? 0 : -1;
    const plan = useTouristMenuPlan({ account: user?.email, open: isOpen });
    const { dashboardItem, quickItems } = getCuratedAccountNav({ permissions });
    const [publishOpen, setPublishOpen] = useState(false);
    const publishRef = useRef<HTMLDivElement>(null);
    const publishLabel = t('nav.publishCta');
    useEffect(() => {
        if (!isOpen) setPublishOpen(false);
        if (!isOpen || !publishOpen) return;
        const dismiss = (event: globalThis.MouseEvent) => {
            if (event.target instanceof Node && !publishRef.current?.contains(event.target)) {
                setPublishOpen(false);
            }
        };
        document.addEventListener('mousedown', dismiss);
        return () => document.removeEventListener('mousedown', dismiss);
    }, [isOpen, publishOpen]);
    return (
        <div className={styles.authSection}>
            <div ref={publishRef}>
                <button
                    type="button"
                    className={styles.ctaLink}
                    tabIndex={tabIndex}
                    aria-haspopup="menu"
                    aria-expanded={publishOpen}
                    aria-label={publishLabel}
                    onClick={() => setPublishOpen((open) => !open)}
                >
                    <BuildingIcon
                        size={18}
                        aria-hidden="true"
                    />
                    {publishLabel}
                    <span aria-hidden="true">…</span>
                </button>
                {publishOpen && (
                    <div
                        role="menu"
                        aria-label={publishLabel}
                        className={styles.accountLinks}
                    >
                        {PUBLISH_CTA_OPTIONS.map(({ id, href, icon: Icon, i18nKey }) => (
                            <a
                                key={id}
                                role="menuitem"
                                href={buildUrl({ locale, path: href })}
                                className={styles.accountLink}
                                onClick={(event) => {
                                    setPublishOpen(false);
                                    onLinkClick(event);
                                }}
                                tabIndex={tabIndex}
                            >
                                <Icon
                                    size={18}
                                    aria-hidden="true"
                                />
                                {t(i18nKey)}
                            </a>
                        ))}
                    </div>
                )}
            </div>
            {user ? (
                <div className={styles.accountLinks}>
                    {dashboardItem && (
                        <a
                            href={buildUrl({ locale, path: dashboardItem.href })}
                            className={styles.userRow}
                            onClick={onLinkClick}
                            tabIndex={tabIndex}
                        >
                            {user.image ? (
                                <img
                                    src={user.image}
                                    alt=""
                                    className={styles.userAvatar}
                                />
                            ) : (
                                <span
                                    className={styles.userInitials}
                                    aria-hidden="true"
                                >
                                    {getInitials(user)}
                                </span>
                            )}
                            <span className={styles.userName}>
                                {t('account.title')}
                                <small className={styles.userSecondary}>
                                    {getAvatarDisplayName(user) || user.email}
                                    <PlanBadge name={plan?.paid ? plan.name : null} />
                                </small>
                            </span>
                            <ChevronRightIcon
                                size={20}
                                aria-hidden="true"
                            />
                        </a>
                    )}
                    {quickItems
                        .filter((item) => item.id !== dashboardItem?.id)
                        .map(({ id, href, icon: Icon, i18nKey }) => (
                            <a
                                key={id}
                                href={buildUrl({ locale, path: href })}
                                className={styles.accountLink}
                                onClick={onLinkClick}
                                tabIndex={tabIndex}
                            >
                                <Icon
                                    size={18}
                                    aria-hidden="true"
                                />
                                {t(i18nKey)}
                            </a>
                        ))}
                    <button
                        type="button"
                        className={styles.signOutButton}
                        tabIndex={tabIndex}
                        onClick={() =>
                            closeThen({ afterClose: () => void signOutFromNavigation({ locale }) })
                        }
                    >
                        <LogoutIcon
                            size={18}
                            aria-hidden="true"
                        />
                        {t('nav.userMenu.signOut')}
                    </button>
                </div>
            ) : (
                <div className={styles.authActions}>
                    <a
                        href={buildUrl({ locale, path: '/auth/signin/' })}
                        onClick={onLinkClick}
                        tabIndex={tabIndex}
                        className="btn-gradient btn-gradient--primary btn-gradient--sm"
                    >
                        {t('nav.signIn')}
                    </a>
                    <a
                        href={buildUrl({ locale, path: '/auth/signup/' })}
                        onClick={onLinkClick}
                        tabIndex={tabIndex}
                        className="btn-gradient btn-gradient--outline-primary btn-gradient--sm"
                    >
                        {t('auth.signUp.submit')}
                    </a>
                </div>
            )}
        </div>
    );
}
