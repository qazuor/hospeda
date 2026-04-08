/**
 * @file MobileMenu.client.tsx
 * @description Full-screen mobile navigation overlay island.
 *
 * Slides in from the right when the element with `[data-mobile-toggle]`
 * is clicked. Closes on:
 * - The close button (CloseIcon)
 * - ESC key press
 * - `astro:before-swap` event (ClientRouter page navigation)
 *
 * Applies a body scroll lock while open and releases it on close.
 * Traps focus on the close button when the menu opens.
 *
 * Tasks: T-074
 */

import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { CloseIcon, SearchIcon } from '@repo/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './MobileMenu.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single navigation link entry. */
interface NavItem {
    /** Display label shown in the menu. */
    readonly label: string;
    /** Destination href for the link. */
    readonly href: string;
}

/** Props for the MobileMenu component. */
interface MobileMenuProps {
    /** Active locale .. passed through for future i18n use. */
    readonly locale: SupportedLocale;
    /** Navigation items rendered as vertical links. */
    readonly navItems: readonly NavItem[];
}

// ---------------------------------------------------------------------------
// MobileMenu
// ---------------------------------------------------------------------------

/**
 * Full-screen mobile navigation overlay.
 *
 * The component listens for clicks on the first `[data-mobile-toggle]`
 * element in the document (typically the hamburger button inside
 * `Header.astro`) and toggles the overlay.
 *
 * Body scroll is locked while the menu is open and restored on close.
 * All event listeners are cleaned up on unmount or when conditions change.
 *
 * @example
 * ```astro
 * ---
 * import MobileMenu from '@/components/shared/MobileMenu.client';
 * ---
 * <MobileMenu locale={locale} navItems={navItems} client:media="(max-width: 768px)" />
 * ```
 */
export function MobileMenu({ locale: _locale, navItems }: MobileMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    // ------------------------------------------------------------------
    // Toggle handler .. wired to the external [data-mobile-toggle] button
    // ------------------------------------------------------------------
    useEffect(() => {
        const toggle = document.querySelector('[data-mobile-toggle]');
        if (!toggle) return;

        const handler = () => setIsOpen((prev) => !prev);
        toggle.addEventListener('click', handler);
        return () => {
            toggle.removeEventListener('click', handler);
        };
    }, []);

    // ------------------------------------------------------------------
    // ESC key closes the menu
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    // ------------------------------------------------------------------
    // astro:before-swap closes the menu on ClientRouter navigation
    // ------------------------------------------------------------------
    useEffect(() => {
        const handleBeforeSwap = () => setIsOpen(false);
        document.addEventListener('astro:before-swap', handleBeforeSwap);
        return () => {
            document.removeEventListener('astro:before-swap', handleBeforeSwap);
        };
    }, []);

    // ------------------------------------------------------------------
    // Body scroll lock
    // ------------------------------------------------------------------
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Move focus to the close button for accessibility
            closeButtonRef.current?.focus();
        } else {
            document.body.style.overflow = previousOverflow;
        }

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen]);

    // ------------------------------------------------------------------
    // Close handler
    // ------------------------------------------------------------------
    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            aria-hidden={!isOpen}
            className={cn(styles.overlay, isOpen && styles.overlayOpen)}
        >
            {/* Header row: close button */}
            <div className={styles.header}>
                <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={handleClose}
                    aria-label="Cerrar menú de navegación"
                    className={styles.closeButton}
                    tabIndex={isOpen ? 0 : -1}
                >
                    <CloseIcon
                        size={24}
                        weight="regular"
                        aria-hidden="true"
                    />
                </button>
            </div>

            {/* Navigation links */}
            <nav
                aria-label="Navegación principal móvil"
                className={styles.nav}
            >
                <ul className={styles.navList}>
                    {navItems.map((item) => (
                        <li key={item.href}>
                            <a
                                href={item.href}
                                onClick={handleClose}
                                tabIndex={isOpen ? 0 : -1}
                                className={styles.navLink}
                            >
                                {item.label}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Bottom search link */}
            <div className={styles.footer}>
                <a
                    href="/busqueda/"
                    onClick={handleClose}
                    tabIndex={isOpen ? 0 : -1}
                    aria-label="Ir a búsqueda"
                    className={styles.searchLink}
                >
                    <SearchIcon
                        size={20}
                        weight="regular"
                        aria-hidden="true"
                    />
                    <span className={styles.searchLabel}>Buscar alojamientos</span>
                </a>
            </div>
        </div>
    );
}
