/**
 * @file MobileDrawer.tsx
 * @description Full-height mobile drawer with overlay, focus trap, body scroll lock,
 * and escape key support. Renders children inside a <dialog> element.
 */

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
// Shared with every other modal-like surface (Dialog, the AI search drawer,
// the AI chat widget). This file used to keep a private copy of the
// selector + boundary-only Tab cycling, bound to the PANEL rather than
// `document` — worse than the shared trap's own prior bug, because a panel
// listener never runs once focus has fallen out to `<body>` (HOS-350).
import { FOCUSABLE_SELECTORS, trapFocus } from '@/lib/focus-trap';
import styles from './MobileDrawer.module.css';

/** Props for the MobileDrawer component. */
export interface MobileDrawerProps {
    /** Whether the drawer is currently open. */
    readonly isOpen: boolean;
    /** Called when the user requests to close the drawer (overlay click, Escape key). */
    readonly onClose: () => void;
    /** Content rendered inside the drawer panel. */
    readonly children: ReactNode;
    /** Accessible label for the dialog element. */
    readonly ariaLabel?: string;
}

/**
 * Mobile drawer component with overlay, focus trap, body scroll lock, and escape key.
 *
 * - Body scroll is locked while the drawer is open.
 * - Tab key cycles focus within focusable elements inside the panel.
 * - Escape key closes the drawer.
 * - Clicking the backdrop overlay closes the drawer.
 *
 * @param props - See {@link MobileDrawerProps}.
 */
export function MobileDrawer({ isOpen, onClose, children, ariaLabel }: MobileDrawerProps) {
    const panelRef = useRef<HTMLDialogElement>(null);

    // Lock body scroll while drawer is open + publish a flag on <html> so other
    // floating UI (e.g. the global feedback FAB) can hide itself while a drawer
    // overlay is active. Mirrors the existing `data-mobile-menu-open` /
    // `data-search-panel-open` conventions used elsewhere in the app.
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.documentElement.dataset.filtersDrawerOpen = '';
        } else {
            document.body.style.overflow = '';
            delete document.documentElement.dataset.filtersDrawerOpen;
        }
        return () => {
            document.body.style.overflow = '';
            delete document.documentElement.dataset.filtersDrawerOpen;
        };
    }, [isOpen]);

    // Trap focus inside the drawer when open. Bound to `document` (not the
    // panel) so it still catches Tab once focus has fallen out to `<body>` —
    // see `@/lib/focus-trap` for why that matters.
    useEffect(() => {
        if (!isOpen || !panelRef.current) return;
        const panel = panelRef.current;
        const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
        focusable[0]?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            trapFocus(panel, e);
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    return (
        <>
            {/* Overlay — only visible/clickable on mobile via CSS */}
            {isOpen && (
                <div
                    className={styles.drawerOverlay}
                    onClick={onClose}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') onClose();
                    }}
                    aria-hidden="true"
                />
            )}

            <dialog
                ref={panelRef}
                className={`${styles.drawer}${isOpen ? ` ${styles.drawerOpen}` : ''}`}
                aria-label={ariaLabel}
                open={isOpen}
            >
                {children}
            </dialog>
        </>
    );
}
