/** One mobile avatar and complete account sheet per page, shared by both headers. */
import { LogoutIcon } from '@repo/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountSidebar } from '@/components/account/ui/AccountSidebar';
import { buildSidebarView } from '@/components/account/ui/account-sidebar-view';
import { Drawer } from '@/components/account/ui/Drawer';
import { BenefitUsagesCountPill } from '@/components/host/host-trades/BenefitUsagesCountPill.client';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { useNavigationDialog } from '@/hooks/use-navigation-dialog';
import { ACCOUNT_NAV_ICONS } from '@/lib/account-nav-icons';
import { buildAccountNavModel, getActiveSectionKey } from '@/lib/account-nav-model';
import { buildFullAccountMenu } from '@/lib/account-nav-shell';
import { onOpenAccountSheet } from '@/lib/account-sheet-events';
import { buildAdminPanelItem } from '@/lib/admin-panel-link';
import { getInitials } from '@/lib/avatar-utils';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { signOutAndClearClientState } from '@/lib/sign-out';
import styles from './AccountSheet.module.css';

/** Header-owned account sheet inputs; public pages do not resolve MCP on the server. */
export interface AccountSheetProps {
    readonly locale: SupportedLocale;
    readonly mcpEnabled?: boolean;
    readonly adminPanelUrl?: string;
}

/** Renders nothing for guests; permissions and ownership resolve in the browser. */
export function AccountSheet({ locale, mcpEnabled = false, adminPanelUrl }: AccountSheetProps) {
    const t = createT(locale);
    const { user, permissions, ownsHostTradeListing, ownsPartner } = useAccountPermissions({
        syncAuthenticatedAttribute: false
    });
    const [open, setOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [signOutFailed, setSignOutFailed] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const close = useCallback(() => setOpen(false), []);
    const { closeThen, onLinkClick } = useNavigationDialog({ open, onClose: close });
    const show = useCallback(() => {
        if (!user || window.matchMedia('(min-width: 1025px)').matches) return;
        // Drawer restores the previously focused element, including event-driven opens.
        triggerRef.current?.focus();
        setOpen(true);
    }, [user]);
    useEffect(() => onOpenAccountSheet(show), [show]);
    useEffect(() => {
        const media = window.matchMedia('(min-width: 1025px)');
        const changed = () => {
            if (media.matches) close();
        };
        media.addEventListener('change', changed);
        return () => media.removeEventListener('change', changed);
    }, [close]);
    useEffect(() => {
        if (!user) close();
    }, [user, close]);

    if (!user) return null;
    const activeSection =
        typeof window === 'undefined'
            ? ''
            : getActiveSectionKey({
                  href: window.location.pathname,
                  search: window.location.search
              });
    const model = buildAccountNavModel({
        roles: null,
        permissions: permissions ?? [],
        ownsHostTradeListing,
        ownsPartner,
        mcpEnabled,
        activeSection
    });
    const shell = buildFullAccountMenu({
        groups: model.groups,
        doors: model.doors,
        activeSection,
        ownsPartner
    });
    const view = buildSidebarView({ model: { ...model, shell }, locale });
    const admin = buildAdminPanelItem({ locale, adminPanelUrl, permissions: permissions ?? [] });
    const name = user.name.trim() || user.email;
    const avatar = user.avatarUrl ? (
        <img
            src={user.avatarUrl}
            alt=""
            className={styles.avatar}
        />
    ) : (
        <span
            aria-hidden="true"
            className={styles.avatar}
        >
            {getInitials({ name: user.name, email: user.email, placeholder: '?' })}
        </span>
    );

    const handleSignOut = async () => {
        setSigningOut(true);
        setSignOutFailed(false);
        const result = await signOutAndClearClientState();
        if (result.ok) {
            closeThen({ afterClose: () => window.location.reload() });
        } else {
            setSignOutFailed(true);
            setSigningOut(false);
        }
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className={styles.trigger}
                aria-label={t('account.sheet.title')}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={show}
            >
                {avatar}
            </button>
            <Drawer
                open={open}
                onOpenChange={(value) => {
                    if (!value) close();
                }}
                title={t('account.sheet.title')}
                locale={locale}
                side="bottom"
                claimHistoryEntry={false}
                footer={
                    <div>
                        {signOutFailed ? (
                            <p role="alert">{t('account.sheet.signOutError')}</p>
                        ) : null}
                        <button
                            type="button"
                            className={styles.signOut}
                            disabled={signingOut}
                            aria-busy={signingOut}
                            onClick={() => void handleSignOut()}
                        >
                            <LogoutIcon
                                size={18}
                                aria-hidden="true"
                            />
                            {t(signingOut ? 'account.sheet.signingOut' : 'account.sheet.signOut')}
                        </button>
                    </div>
                }
            >
                <div className={styles.identity}>
                    {avatar}
                    <div>
                        <strong>{name}</strong>
                        <p>{user.email}</p>
                    </div>
                </div>
                <div onClickCapture={onLinkClick}>
                    <AccountSidebar
                        view={view}
                        locale={locale}
                        icons={ACCOUNT_NAV_ICONS}
                        benefitUsagesCount={<BenefitUsagesCountPill locale={locale} />}
                    />
                    {admin ? (
                        <a
                            className={styles.admin}
                            href={admin.href}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <admin.icon
                                size={18}
                                aria-hidden="true"
                            />
                            {admin.label}
                        </a>
                    ) : null}
                </div>
            </Drawer>
        </>
    );
}
