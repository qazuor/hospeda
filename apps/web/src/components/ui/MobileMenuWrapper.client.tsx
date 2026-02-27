import { MenuIcon } from '@repo/icons';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';
import { MobileMenu, type NavItem } from './MobileMenu.client';

/**
 * Props for the MobileMenuWrapper component
 */
export interface MobileMenuWrapperProps {
    readonly navItems: ReadonlyArray<NavItem>;
    readonly locale?: 'es' | 'en' | 'pt';
}

/**
 * Wrapper component that manages MobileMenu open/close state.
 * Renders the hamburger trigger button and the MobileMenu dialog.
 *
 * @param props - Component props
 * @returns Trigger button + MobileMenu dialog
 */
export function MobileMenuWrapper({
    navItems,
    locale = 'es'
}: MobileMenuWrapperProps): ReactElement {
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'ui' });

    return (
        <>
            <button
                type="button"
                className="inline-flex items-center justify-center rounded-md p-2 text-text-secondary hover:bg-bg hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 md:hidden"
                aria-label={t('accessibility.openMenu')}
                onClick={() => setIsOpen(true)}
            >
                <MenuIcon
                    size={24}
                    aria-hidden="true"
                />
            </button>
            <MobileMenu
                navItems={navItems}
                locale={locale}
                open={isOpen}
                onClose={() => setIsOpen(false)}
            />
        </>
    );
}
