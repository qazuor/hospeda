/**
 * MobileMenu Component
 *
 * Mobile navigation drawer that shows all sections.
 * Opens from the left side on mobile devices.
 *
 * Accessibility features:
 * - Focus trap when open
 * - Escape key to close
 * - aria-modal for screen readers
 * - Focus restoration on close
 */

import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@repo/i18n';
import { CloseIcon } from '@repo/icons';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useCallback, useEffect, useRef } from 'react';

interface MobileNavItem {
    id: string;
    label: string;
    labelKey?: string;
    href: string;
    icon?: ReactNode;
    isActive?: boolean;
}

export interface MobileMenuProps {
    /** Whether the menu is open */
    isOpen: boolean;
    /** Callback to close the menu */
    onClose: () => void;
    /** Navigation items */
    items: MobileNavItem[];
}

/**
 * MobileMenu renders a slide-in drawer for mobile navigation.
 */
export function MobileMenu({ isOpen, onClose, items }: MobileMenuProps) {
    const { t } = useTranslations();
    const drawerRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    // Store the previously focused element when opening
    useEffect(() => {
        if (isOpen) {
            previousFocusRef.current = document.activeElement as HTMLElement;
            // Focus the close button when menu opens
            closeButtonRef.current?.focus();
        } else if (previousFocusRef.current) {
            // Restore focus when menu closes
            previousFocusRef.current.focus();
            previousFocusRef.current = null;
        }
    }, [isOpen]);

    // Handle escape key globally when open
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Focus trap within the drawer
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key !== 'Tab' || !drawerRef.current) return;

        const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
        }
    }, []);

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    'fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 md:hidden',
                    isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                )}
                onClick={onClose}
                onKeyDown={(e) => e.key === 'Enter' && onClose()}
                role="presentation"
            />

            {/* Drawer */}
            <aside
                ref={drawerRef}
                className={cn(
                    'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar shadow-lg transition-transform duration-200 ease-out md:hidden',
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                )}
                aria-label={t('admin-common.aria.mobileNavigation' as TranslationKey)}
                aria-hidden={!isOpen}
                onKeyDown={handleKeyDown}
            >
                {/* Header */}
                <div className="flex h-14 items-center justify-between border-b px-4">
                    <span className="font-semibold text-lg">{t('admin-nav.topbar.admin')}</span>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-2 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={t('admin-common.aria.closeMenu')}
                    >
                        <CloseIcon
                            className="h-5 w-5"
                            aria-hidden="true"
                        />
                    </button>
                </div>

                {/* Navigation */}
                <nav
                    className="flex flex-col gap-1 p-4"
                    aria-label="Mobile sections"
                >
                    {items.map((item) => (
                        <MobileMenuItem
                            key={item.id}
                            item={item}
                            onClose={onClose}
                        />
                    ))}
                </nav>
            </aside>
        </>
    );
}

interface MobileMenuItemProps {
    item: MobileNavItem;
    onClose: () => void;
}

function MobileMenuItem({ item, onClose }: MobileMenuItemProps) {
    const { t } = useTranslations();
    const displayLabel = item.labelKey ? t(item.labelKey as TranslationKey) : item.label;

    return (
        <Link
            to={item.href}
            onClick={onClose}
            className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 font-medium text-sm transition-colors duration-150',
                item.isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
            aria-current={item.isActive ? 'page' : undefined}
        >
            {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
            <span>{displayLabel}</span>
        </Link>
    );
}
