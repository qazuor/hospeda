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
import { cn } from '../ui/cn.js';
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
    readonly isOpen: boolean;
    /** Called when the modal should close (backdrop click, Escape key, close button) */
    readonly onClose: () => void;
    /** All props passed through to FeedbackForm (onClose is injected automatically) */
    readonly formProps: Omit<FeedbackFormProps, 'onClose'>;
}

const TITLE_ID = 'feedback-modal-title';

/** CSS for the native `::backdrop` pseudo-element (cannot be set via Tailwind). */
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
            // Fallback scroll lock for browsers where showModal() does not
            // fully prevent body scrolling (e.g. some mobile WebKit builds).
            document.body.style.overflow = 'hidden';
        } else {
            if (dialog.open) {
                dialog.close();
            }
            document.body.style.overflow = '';
            // Restore focus to the element that was active before opening
            if (previousFocusRef.current instanceof HTMLElement) {
                previousFocusRef.current.focus();
            }
        }

        return () => {
            document.body.style.overflow = '';
        };
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

    return (
        <>
            {/* ::backdrop cannot be styled with Tailwind; inject minimal CSS */}
            <style>{BACKDROP_CSS}</style>
            <dialog
                ref={dialogRef}
                aria-labelledby={TITLE_ID}
                onClick={handleDialogClick}
                onKeyDown={handleKeyDown}
                className={cn(
                    'fixed inset-0 m-0 flex h-dvh max-h-none w-dvw max-w-none border-none bg-transparent',
                    isMobile ? 'items-end justify-center p-0' : 'items-center justify-center p-6'
                )}
                data-feedback-modal=""
                data-testid="feedback-modal-dialog"
            >
                {/* Inner container: visual styles and focus trap boundary */}
                <div
                    ref={containerRef}
                    className={cn(
                        'relative w-full overflow-y-auto bg-card shadow-xl',
                        isMobile
                            ? 'max-h-[85dvh] rounded-t-2xl px-5 pt-5 pb-7'
                            : 'max-h-[90vh] max-w-[640px] rounded-xl p-6'
                    )}
                    tabIndex={-1}
                    data-testid="feedback-modal-content"
                >
                    {/* Visually hidden title for screen readers */}
                    <span
                        id={TITLE_ID}
                        className="sr-only"
                    >
                        {FEEDBACK_STRINGS.form.title}
                    </span>

                    {/* Drag handle for mobile drawer */}
                    {isMobile && (
                        <div
                            className="mx-auto mb-4 h-1 w-10 rounded-full bg-border"
                            aria-hidden="true"
                        />
                    )}

                    {/* Close button (visible on both mobile and desktop) */}
                    <button
                        type="button"
                        className="absolute top-4 right-4 z-10 flex items-center justify-center rounded p-1 text-muted-foreground text-xl leading-none transition-colors hover:text-foreground"
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
