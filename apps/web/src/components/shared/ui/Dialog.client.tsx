/**
 * @file Dialog.client.tsx
 * @description Reusable modal dialog. Renders via React Portal to
 * `document.body` so it escapes any ancestor `overflow: hidden` and is never
 * clipped. Handles all the cross-cutting concerns once so consumers do not
 * have to:
 *
 *   - Centered viewport-anchored panel.
 *   - Dimmed backdrop (overlay element + optional blur).
 *   - Locks scroll on `<html>` AND `<body>` while open (locking only `body`
 *     fails when `<html>` is the scroll root).
 *   - Closes on `Escape` (when `closeOnEscape !== false`).
 *   - Closes on click on the overlay (when `closeOnOverlayClick !== false`).
 *   - Focus management: focuses the panel on open, restores focus to the
 *     element that had it before opening on close.
 *   - Lightweight focus-trap so Tab cannot escape the panel.
 *   - SSR-safe (only renders after mount).
 *   - Sized via `size`: sm | md | lg | full.
 *   - Visual variant via `variant`: solid (default) | transparent (the panel
 *     surrenders its background, used by the image lightbox).
 *
 * Use the Header/Body components for the standard structure, or pass any
 * children for a custom layout.
 */

import type { JSX, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../lib/cn';
import styles from './Dialog.module.css';

// ---------------------------------------------------------------------------
// Focus trap
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTORS =
    'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
    if (focusable.length === 0) return;
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    if (event.key !== 'Tab') return;
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type DialogSize = 'sm' | 'md' | 'lg' | 'full';
export type DialogVariant = 'solid' | 'transparent';

export interface DialogProps {
    /** Controlled open state. When `false` the dialog renders nothing. */
    readonly isOpen: boolean;
    /** Called when the user requests close (Esc, overlay click, close button). */
    readonly onClose: () => void;
    /** Modal contents. Use the exported `DialogHeader`/`DialogBody` for the standard layout. */
    readonly children: ReactNode;
    /** Accessible name for the dialog. Required when no visible title is rendered. */
    readonly ariaLabel?: string;
    /** Element id of a visible title; sets `aria-labelledby`. */
    readonly ariaLabelledBy?: string;
    /** Size preset for the panel. Defaults to `md`. */
    readonly size?: DialogSize;
    /** Visual variant. `transparent` removes the panel chrome (used by lightboxes). */
    readonly variant?: DialogVariant;
    /** Whether `Esc` closes the dialog. Default: `true`. */
    readonly closeOnEscape?: boolean;
    /** Whether clicking the overlay closes the dialog. Default: `true`. */
    readonly closeOnOverlayClick?: boolean;
    /** Optional extra class on the panel. */
    readonly className?: string;
    /** Optional extra class on the overlay. */
    readonly overlayClassName?: string;
}

/**
 * Reusable modal dialog. See file header for capabilities.
 */
export function Dialog({
    isOpen,
    onClose,
    children,
    ariaLabel,
    ariaLabelledBy,
    size = 'md',
    variant = 'solid',
    closeOnEscape = true,
    closeOnOverlayClick = true,
    className,
    overlayClassName
}: DialogProps): JSX.Element | null {
    const panelRef = useRef<HTMLDivElement>(null);
    // Render only after mount so SSR + initial hydration don't try to use `document`.
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Lock scroll on <html> AND <body> while open. Locking only body fails
    // when <html> is the scrolling element. Restores prior values on close.
    useEffect(() => {
        if (!isOpen || !mounted) return;
        const html = document.documentElement;
        const body = document.body;
        const originalHtmlOverflow = html.style.overflow;
        const originalBodyOverflow = body.style.overflow;
        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        return () => {
            html.style.overflow = originalHtmlOverflow;
            body.style.overflow = originalBodyOverflow;
        };
    }, [isOpen, mounted]);

    // Focus management: when the dialog opens, remember where focus was and
    // move it into the panel. When it closes, restore focus to the trigger.
    useEffect(() => {
        if (!isOpen || !mounted) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        // Focus the panel root so screen readers announce the dialog and Tab
        // starts inside the trap. Use a microtask to wait for the DOM to settle.
        const id = requestAnimationFrame(() => panelRef.current?.focus());
        return () => {
            cancelAnimationFrame(id);
            previouslyFocused?.focus?.();
        };
    }, [isOpen, mounted]);

    // Keyboard handling: Esc + focus trap.
    useEffect(() => {
        if (!isOpen || !mounted) return;
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape' && closeOnEscape) {
                event.preventDefault();
                onClose();
                return;
            }
            if (panelRef.current) {
                trapFocus(panelRef.current, event);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, mounted, onClose, closeOnEscape]);

    const handleOverlayClick = useCallback(
        (event: React.MouseEvent<HTMLDivElement>): void => {
            if (!closeOnOverlayClick) return;
            // Only close when the click target is the overlay itself, not a child.
            if (event.target === event.currentTarget) onClose();
        },
        [closeOnOverlayClick, onClose]
    );

    if (!mounted || !isOpen) return null;

    return createPortal(
        // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled via the document listener for Esc + focus trap.
        <div
            className={cn(styles.overlay, overlayClassName)}
            onClick={handleOverlayClick}
            role="presentation"
        >
            <div
                ref={panelRef}
                className={cn(styles.panel, className)}
                data-size={size}
                data-variant={variant}
                // biome-ignore lint/a11y/useSemanticElements: <dialog> would inherit user-agent width/margin/border that fight the panel layout, and jsdom does not implement showModal() reliably for tests.
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                tabIndex={-1}
            >
                {children}
            </div>
        </div>,
        document.body
    );
}

// ---------------------------------------------------------------------------
// Composable sub-components
// ---------------------------------------------------------------------------

interface DialogHeaderProps {
    readonly children: ReactNode;
    readonly onClose?: () => void;
    readonly closeLabel?: string;
    readonly titleId?: string;
}

/**
 * Standard dialog header with a title slot and an optional close button.
 * Pair the rendered `<h2 id={titleId}>` with the parent `Dialog`'s
 * `ariaLabelledBy={titleId}` for proper labelling.
 */
export function DialogHeader({
    children,
    onClose,
    closeLabel = 'Cerrar',
    titleId
}: DialogHeaderProps): JSX.Element {
    return (
        <header className={styles.header}>
            <h2
                id={titleId}
                className={styles.title}
            >
                {children}
            </h2>
            {onClose && (
                <button
                    type="button"
                    className={styles.closeButton}
                    onClick={onClose}
                    aria-label={closeLabel}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                    >
                        <path
                            d="M12 4L4 12M4 4l8 8"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            )}
        </header>
    );
}

interface DialogBodyProps {
    readonly children: ReactNode;
    /** When true, removes default padding (used by the image lightbox). */
    readonly bare?: boolean;
    readonly className?: string;
}

/**
 * Standard scrollable body. When the dialog content is taller than the
 * panel max-height, the body is the scroll container.
 */
export function DialogBody({ children, bare = false, className }: DialogBodyProps): JSX.Element {
    return <div className={cn(bare ? styles.bodyBare : styles.body, className)}>{children}</div>;
}

interface DialogFooterProps {
    readonly children: ReactNode;
    readonly className?: string;
}

/**
 * Sticky footer for action buttons (e.g. Cancel + Confirm). Sits at the
 * bottom of the panel separated from the body by a border.
 */
export function DialogFooter({ children, className }: DialogFooterProps): JSX.Element {
    return <footer className={cn(styles.footer, className)}>{children}</footer>;
}

/**
 * A floating close button suited for the transparent (lightbox) variant —
 * sits in the top-right corner of the panel with a dark contrast pill.
 */
export function DialogFloatingCloseButton({
    onClose,
    closeLabel = 'Cerrar'
}: {
    readonly onClose: () => void;
    readonly closeLabel?: string;
}): JSX.Element {
    return (
        <button
            type="button"
            className={cn(styles.closeButton, styles.closeButtonFloating)}
            onClick={onClose}
            aria-label={closeLabel}
        >
            <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
            >
                <path
                    d="M15 5L5 15M5 5l10 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
            </svg>
        </button>
    );
}
