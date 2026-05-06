/**
 * @file MobileDrawer.tsx
 * @description Full-height mobile drawer with overlay, focus trap, body scroll lock,
 * and escape key support. Renders children inside a <dialog> element.
 */

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
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

    // Lock body scroll while drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Trap focus inside the drawer when open
    useEffect(() => {
        if (!isOpen || !panelRef.current) return;
        const panel = panelRef.current;
        const focusable = panel.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        first?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key !== 'Tab') return;
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        };

        panel.addEventListener('keydown', handleKeyDown);
        return () => panel.removeEventListener('keydown', handleKeyDown);
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
