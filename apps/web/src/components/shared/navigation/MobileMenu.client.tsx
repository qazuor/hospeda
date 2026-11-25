/** Site-only mobile menu. Account navigation is owned by the header account sheet. */
import { CloseIcon } from '@repo/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BrandWordmark } from '@/components/shared/brand/BrandWordmark';
import { LanguageSwitcher } from '@/components/shared/preferences/LanguageSwitcher.client';
import { ThemeControl } from '@/components/shared/preferences/ThemeControl.client';
import { IconButton } from '@/components/ui/IconButtonReact';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { useNavigationDialog } from '@/hooks/use-navigation-dialog';
import { openAccountSheet } from '@/lib/account-sheet-events';
import type { AuthMeUser } from '@/lib/auth-cache';
import { cn } from '@/lib/cn';
import { trapFocus } from '@/lib/focus-trap';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './MobileMenu.module.css';
import { MobileMenuAccountSection } from './MobileMenuAccountSection.client';
import { MobileMenuNavList } from './MobileMenuNavList.client';

interface NavItem {
    readonly label: string;
    readonly href: string;
    readonly children?: readonly { readonly label: string; readonly href: string }[];
}

interface MobileMenuProps {
    readonly locale: SupportedLocale;
    readonly navItems: readonly NavItem[];
    readonly currentPath: string;
    readonly logoSrc: string;
    readonly homeHref: string;
    readonly initialUser: AuthMeUser | null;
    readonly initialRoles: readonly string[];
    /** Kept for existing island callers; the account sheet owns the staff link. */
    readonly adminPanelUrl?: string;
}

/** Renders site links, publishing and a single account-sheet handoff row. */
export function MobileMenu({
    locale,
    navItems,
    currentPath,
    logoSrc,
    homeHref,
    initialUser,
    initialRoles
}: MobileMenuProps) {
    const { t } = createTranslations(locale);
    const [isOpen, setIsOpen] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const close = useCallback(() => setIsOpen(false), []);
    const { closeThen, onLinkClick } = useNavigationDialog({ open: isOpen, onClose: close });
    const { user, permissions } = useAccountPermissions({
        initialUser,
        initialRoles,
        syncAuthenticatedAttribute: false
    });
    // HOS-312: do not flash guest controls while the session is unresolved.
    const showGuestPreferences = user === null && permissions !== null;

    useEffect(() => {
        const toggle = () => setIsOpen((previous) => !previous);
        window.addEventListener('mobile-menu:toggle', toggle);
        return () => window.removeEventListener('mobile-menu:toggle', toggle);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const previousOverflow = document.documentElement.style.overflow;
        const previousFocus = document.activeElement as HTMLElement | null;
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.setAttribute('data-mobile-menu-open', '');
        closeButtonRef.current?.focus();
        const keydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close();
            if (overlayRef.current) trapFocus(overlayRef.current, event);
        };
        document.addEventListener('keydown', keydown);
        return () => {
            document.removeEventListener('keydown', keydown);
            document.documentElement.style.overflow = previousOverflow;
            document.documentElement.removeAttribute('data-mobile-menu-open');
            previousFocus?.focus();
        };
    }, [isOpen, close]);

    return (
        <div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.mobileMenu', 'Navigation menu')}
            aria-hidden={!isOpen}
            className={cn(styles.overlay, isOpen && styles.overlayOpen)}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 'var(--z-mobile-menu)',
                transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                pointerEvents: isOpen ? 'auto' : 'none'
            }}
        >
            <div className={styles.header}>
                <a
                    href={homeHref}
                    onClick={onLinkClick}
                    tabIndex={isOpen ? 0 : -1}
                    className={styles.logoLink}
                    aria-label={t('nav.goHome')}
                >
                    <BrandWordmark logoSrc={logoSrc} />
                </a>
                <IconButton
                    ref={closeButtonRef}
                    ariaLabel={t('nav.closeMenu')}
                    variant="ghost"
                    size="md"
                    onClick={close}
                    tabIndex={isOpen ? 0 : -1}
                >
                    <CloseIcon
                        size={24}
                        weight="regular"
                        aria-hidden="true"
                    />
                </IconButton>
            </div>
            <nav
                aria-label={t('nav.mainNavigation')}
                className={styles.nav}
            >
                <MobileMenuNavList
                    navItems={navItems}
                    isOpen={isOpen}
                    onLinkClick={onLinkClick}
                />
            </nav>
            <MobileMenuAccountSection
                locale={locale}
                t={t}
                isOpen={isOpen}
                user={user ? { name: user.name, email: user.email, image: user.avatarUrl } : null}
                onOpenAccount={() => closeThen({ afterClose: openAccountSheet })}
                onLinkClick={onLinkClick}
            />
            {showGuestPreferences ? (
                <div className={styles.preferencesSection}>
                    <div className={styles.preferencesGroup}>
                        <span className={styles.preferencesLabel}>{t('nav.language')}</span>
                        <LanguageSwitcher
                            locale={locale}
                            currentPath={currentPath}
                            variant="mobile"
                        />
                    </div>
                    <div className={styles.preferencesGroup}>
                        <span className={styles.preferencesLabel}>{t('nav.theme')}</span>
                        <ThemeControl
                            variant="mobile"
                            showLabels
                        />
                    </div>
                </div>
            ) : null}
        </div>
    );
}
