/**
 * @repo/feedback - FeedbackModal component
 *
 * Wraps FeedbackForm in a responsive container:
 * - Desktop (>= 640px): Centered modal overlay with close button
 * - Mobile (< 640px): Bottom-anchored drawer that slides up
 *
 * Handles focus trapping, keyboard navigation (Escape to close, Tab cycling),
 * and ARIA attributes for accessibility compliance.
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
    backdrop: {
        position: 'fixed' as const,
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    backdropMobile: {
        position: 'fixed' as const,
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center'
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
 * Renders FeedbackForm inside an accessible, responsive overlay container.
 * On desktop (viewport >= 640px) it shows a centered modal card. On mobile
 * it shows a bottom-anchored drawer with a drag handle visual indicator.
 *
 * Focus is trapped inside the dialog while open. Pressing Escape or clicking
 * the backdrop closes the modal. When the modal closes, focus returns to the
 * element that was focused before the modal opened.
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
    // Focus management
    // ------------------------------------------------------------------ //

    useEffect(() => {
        if (!isOpen) return;

        // Store previously focused element to restore on close
        previousFocusRef.current = document.activeElement;

        // Focus the first focusable element inside the modal
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

    useEffect(() => {
        if (isOpen) return;

        // Restore focus when modal closes
        if (previousFocusRef.current && previousFocusRef.current instanceof HTMLElement) {
            previousFocusRef.current.focus();
        }
    }, [isOpen]);

    // ------------------------------------------------------------------ //
    // Keyboard handling
    // ------------------------------------------------------------------ //

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLElement>) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }

            if (e.key !== 'Tab' || !containerRef.current) return;

            const focusable = getFocusableElements(containerRef.current);
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                // Shift+Tab: wrap from first to last
                if (document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
            } else {
                // Tab: wrap from last to first
                if (document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        },
        [onClose]
    );

    // ------------------------------------------------------------------ //
    // Backdrop click handler
    // ------------------------------------------------------------------ //

    const handleBackdropClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            // Only close if clicking the backdrop itself, not the modal content
            if (e.target === e.currentTarget) {
                onClose();
            }
        },
        [onClose]
    );

    // ------------------------------------------------------------------ //
    // Render
    // ------------------------------------------------------------------ //

    if (!isOpen) return null;

    const backdropStyle = isMobile ? styles.backdropMobile : styles.backdrop;
    const contentStyle = isMobile ? styles.drawer : styles.modal;

    return (
        <div
            style={backdropStyle}
            aria-hidden="true"
            onClick={handleBackdropClick}
            onKeyUp={(e) => {
                if (e.key === 'Escape') onClose();
            }}
            data-testid="feedback-modal-backdrop"
        >
            {/*
             * <dialog> satisfies Biome's useSemanticElements rule.
             * It is unstyled here; all visual styles are on the inner div
             * so that the focus trap ref and content layout work correctly.
             */}
            <dialog
                aria-modal="true"
                aria-labelledby={TITLE_ID}
                open
                style={{
                    position: 'relative',
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    background: 'transparent',
                    maxWidth: isMobile ? 'none' : '640px',
                    width: isMobile ? '100%' : 'calc(100% - 48px)',
                    inset: 'unset'
                }}
                onKeyDown={handleKeyDown}
                data-testid="feedback-modal-dialog"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Inner container: holds all visual styles and serves as focus trap boundary */}
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

                    {/* Close button for desktop modal */}
                    {!isMobile && (
                        <button
                            type="button"
                            style={styles.closeButton}
                            onClick={onClose}
                            aria-label={FEEDBACK_STRINGS.buttons.close}
                            data-testid="feedback-modal-close"
                        >
                            &#x2715;
                        </button>
                    )}

                    <FeedbackForm
                        {...formProps}
                        onClose={onClose}
                    />
                </div>
            </dialog>
        </div>
    );
}
