/**
 * @repo/feedback - FeedbackModal component
 *
 * Wraps FeedbackForm in a responsive container using native `<dialog>` with
 * `.showModal()` for proper accessibility and stacking context:
 * - Desktop (>= 640px): Centered modal overlay with close button
 * - Mobile (< 640px): Bottom-anchored drawer that slides up
 *
 * The native dialog API provides built-in backdrop (`::backdrop`), focus
 * trapping (background becomes `inert`), Escape key handling (`cancel`
 * event), and body scroll lock. Manual Tab cycling is kept for consistent
 * wrap-around behavior across browsers.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { FEEDBACK_STRINGS } from '../config/strings.js';
import { FeedbackForm } from './FeedbackForm.js';
import type { FeedbackFormProps } from './FeedbackForm.js';

/** Breakpoint in pixels at which the layout switches from drawer to modal */
const MOBILE_BREAKPOINT = 640;

/**
 * Props for the FeedbackModal component.
 *
 * @example
 * ```tsx
 * <FeedbackModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   formProps={{
 *     apiUrl: 'http://localhost:3001',
 *     appSource: 'web',
 *     userId: session?.userId,
 *   }}
 * />
 * ```
 */
export interface FeedbackModalProps {
    /** Whether the modal is open */
    isOpen: boolean;
    /** Called when the modal should close (backdrop click, Escape key, close button) */
    onClose: () => void;
    /** All props passed through to FeedbackForm (onClose is injected automatically) */
    formProps: Omit<FeedbackFormProps, 'onClose'>;
}

const TITLE_ID = 'feedback-modal-title';

/** CSS for the native `::backdrop` pseudo-element (cannot be set inline). */
const BACKDROP_CSS = 'dialog[data-feedback-modal]::backdrop{background:rgba(0,0,0,0.5)}';

/**
 * Returns all focusable elements within a container element.
 *
 * @param container - The DOM element to search within
 * @returns Array of focusable HTMLElements in DOM order
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

const styles = {
    /** Desktop dialog: full-viewport flex container, centered content */
    dialogDesktop: {
        position: 'fixed' as const,
        inset: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: 'none',
        maxHeight: 'none',
        margin: 0,
        padding: '24px',
        border: 'none',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box' as const
    },
    /** Mobile dialog: full-viewport flex container, bottom-aligned content */
    dialogMobile: {
        position: 'fixed' as const,
        inset: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: 'none',
        maxHeight: 'none',
        margin: 0,
        padding: 0,
        border: 'none',
        background: 'transparent',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        boxSizing: 'border-box' as const
    },
    modal: {
        position: 'relative' as const,
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        width: '100%',
        maxWidth: '640px',
        maxHeight: '90vh',
        overflowY: 'auto' as const,
        padding: '24px',
        boxSizing: 'border-box' as const
    },
    drawer: {
        position: 'relative' as const,
        backgroundColor: '#ffffff',
        borderRadius: '16px 16px 0 0',
        boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.25)',
        width: '100%',
        maxHeight: '85vh',
        overflowY: 'auto' as const,
        padding: '20px 20px 28px',
        boxSizing: 'border-box' as const
    },
    dragHandle: {
        width: '40px',
        height: '4px',
        backgroundColor: '#d1d5db',
        borderRadius: '2px',
        margin: '0 auto 16px'
    },
    closeButton: {
        position: 'absolute' as const,
        top: '16px',
        right: '16px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '4px',
        color: '#6b7280',
        fontSize: '20px',
        lineHeight: 1,
        zIndex: 1
    },
    titleHidden: {
        position: 'absolute' as const,
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden' as const,
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap' as const,
        border: 0
    }
} as const;

/**
 * FeedbackModal component.
 *
 * Renders FeedbackForm inside an accessible, responsive overlay using the
 * native `<dialog>` element with `.showModal()`. On desktop (viewport
 * >= 640px) it shows a centered modal card. On mobile it shows a
 * bottom-anchored drawer with a drag handle visual indicator.
 *
 * The native dialog API provides: `::backdrop` overlay, background `inert`
 * (focus trapping), `cancel` event (Escape key), and body scroll lock.
 * Manual Tab wrap-around is kept for consistent UX across browsers.
 *
 * When the modal closes, focus returns to the element that was focused
 * before the modal opened.
 *
 * @param props - See {@link FeedbackModalProps}
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <FeedbackModal
 *   isOpen={open}
 *   onClose={() => setOpen(false)}
 *   formProps={{ apiUrl: '/api', appSource: 'web' }}
 * />
 * ```
 */
export function FeedbackModal({ isOpen, onClose, formProps }: FeedbackModalProps) {
    const [isMobile, setIsMobile] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth < MOBILE_BREAKPOINT;
    });

    const dialogRef = useRef<HTMLDialogElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<Element | null>(null);

    // ------------------------------------------------------------------ //
    // Responsive detection
    // ------------------------------------------------------------------ //

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mql = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px)`);

        const handleChange = (e: MediaQueryListEvent) => {
            setIsMobile(!e.matches);
        };

        setIsMobile(!mql.matches);

        mql.addEventListener('change', handleChange);
        return () => mql.removeEventListener('change', handleChange);
    }, []);

    // ------------------------------------------------------------------ //
    // Show / close dialog via native .showModal() / .close()
    // ------------------------------------------------------------------ //

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (isOpen) {
            previousFocusRef.current = document.activeElement;
            if (!dialog.open) {
                dialog.showModal();
            }
        } else {
            if (dialog.open) {
                dialog.close();
            }
            // Restore focus to the element that was active before opening
            if (previousFocusRef.current instanceof HTMLElement) {
                previousFocusRef.current.focus();
            }
        }
    }, [isOpen]);

    // ------------------------------------------------------------------ //
    // Native cancel event (Escape key) — let React state drive close
    // ------------------------------------------------------------------ //

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const handleCancel = (e: Event) => {
            e.preventDefault();
            onClose();
        };

        dialog.addEventListener('cancel', handleCancel);
        return () => dialog.removeEventListener('cancel', handleCancel);
    }, [onClose]);

    // ------------------------------------------------------------------ //
    // Focus first element after showing
    // ------------------------------------------------------------------ //

    useEffect(() => {
        if (!isOpen) return;

        const frame = requestAnimationFrame(() => {
            if (!containerRef.current) return;
            const focusable = getFocusableElements(containerRef.current);
            if (focusable.length > 0) {
                focusable[0]?.focus();
            } else {
                containerRef.current.focus();
            }
        });

        return () => cancelAnimationFrame(frame);
    }, [isOpen]);

    // ------------------------------------------------------------------ //
    // Tab wrap-around (native dialog makes background inert, but
    // wrap-around from last→first is not guaranteed across browsers)
    // ------------------------------------------------------------------ //

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key !== 'Tab' || !containerRef.current) return;

        const focusable = getFocusableElements(containerRef.current);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

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
    }, []);

    // ------------------------------------------------------------------ //
    // Backdrop click — click on dialog (outside content) closes
    // ------------------------------------------------------------------ //

    const handleDialogClick = useCallback(
        (e: React.MouseEvent<HTMLDialogElement>) => {
            if (e.target === dialogRef.current) {
                onClose();
            }
        },
        [onClose]
    );

    // ------------------------------------------------------------------ //
    // Render
    // ------------------------------------------------------------------ //

    const dialogStyle = isMobile ? styles.dialogMobile : styles.dialogDesktop;
    const contentStyle = isMobile ? styles.drawer : styles.modal;

    return (
        <>
            {/* ::backdrop cannot be styled inline; inject minimal CSS */}
            <style>{BACKDROP_CSS}</style>
            <dialog
                ref={dialogRef}
                aria-labelledby={TITLE_ID}
                onClick={handleDialogClick}
                onKeyDown={handleKeyDown}
                style={dialogStyle}
                data-feedback-modal=""
                data-testid="feedback-modal-dialog"
            >
                {/* Inner container: visual styles and focus trap boundary */}
                <div
                    ref={containerRef}
                    style={contentStyle}
                    tabIndex={-1}
                    data-testid="feedback-modal-content"
                >
                    {/* Visually hidden title for screen readers */}
                    <span
                        id={TITLE_ID}
                        style={styles.titleHidden}
                    >
                        {FEEDBACK_STRINGS.form.title}
                    </span>

                    {/* Drag handle for mobile drawer */}
                    {isMobile && (
                        <div
                            style={styles.dragHandle}
                            aria-hidden="true"
                        />
                    )}

                    {/* Close button (visible on both mobile and desktop) */}
                    <button
                        type="button"
                        style={styles.closeButton}
                        onClick={onClose}
                        aria-label={FEEDBACK_STRINGS.buttons.close}
                        data-testid="feedback-modal-close"
                    >
                        &#x2715;
                    </button>

                    <FeedbackForm
                        {...formProps}
                        onClose={onClose}
                    />
                </div>
            </dialog>
        </>
    );
}
