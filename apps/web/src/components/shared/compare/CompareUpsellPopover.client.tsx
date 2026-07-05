/**
 * @file CompareUpsellPopover.client.tsx
 * @description Contextual popover prompting an authenticated user whose plan
 * lacks the comparison entitlement to upgrade (HOS-85 post-review fix).
 *
 * Shown when an authenticated user clicks the "Comparar alojamientos" mode
 * toggle but their plan does not include `can_compare_accommodations`. The
 * owner explicitly asked for a popover (not just a toast) so the explanation
 * is anchored to the control the user just clicked, matching the guest-facing
 * {@link AuthRequiredPopover} UX for the analogous unauthenticated case.
 *
 * This is a sibling of `AuthRequiredPopover.client.tsx` rather than a
 * generalization of it: `AuthRequiredPopover` hardcodes a two-button
 * sign-in/register action row with fixed `/auth/signin/` and `/auth/signup/`
 * hrefs, which does not fit a single "Ver planes" CTA pointing at the pricing
 * page. Mirroring its positioning/lifecycle logic instead of bolting a new
 * shape onto a shared, widely-used component (also consumed by
 * `FavoriteButton.client.tsx`) follows the same precedent already established
 * by `CollectionPickerPopover.tsx`, which documents itself as "mirroring the
 * approach used by AuthRequiredPopover" for the same reason.
 *
 * Rendered via React Portal to `document.body` with `position: fixed` so the
 * popover is never clipped by ancestor `overflow: hidden` and never affects
 * parent layout. Position is computed from the anchor element's bounding rect
 * with auto-flip (above/below) and auto-shift (clamped to viewport).
 */

import { CrownIcon } from '@repo/icons';
import type { JSX, RefObject } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import styles from './CompareUpsellPopover.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the CompareUpsellPopover component.
 */
export interface CompareUpsellPopoverProps {
    /**
     * Ref to the trigger element (usually the button that opens the popover).
     * The popover is positioned relative to this element's bounding rect.
     */
    readonly anchorRef: RefObject<HTMLElement | null>;
    /** Message displayed in the popover header explaining the plan gap. */
    readonly message: string;
    /** Label for the single call-to-action link. */
    readonly ctaLabel: string;
    /** Href for the call-to-action link (typically the plans/pricing page). */
    readonly ctaHref: string;
    /** Called when the user closes the popover. */
    readonly onClose: () => void;
    /** Additional CSS class to apply to the popover container. */
    readonly className?: string;
    /** Accessible label for the dialog. */
    readonly dialogLabel: string;
    /** Accessible label for the close button. */
    readonly closeLabel: string;
}

// ---------------------------------------------------------------------------
// Position computation
// ---------------------------------------------------------------------------

interface PopoverPosition {
    readonly top: number;
    readonly left: number;
    readonly arrowLeft: number;
    readonly placement: 'bottom' | 'top';
}

/** Vertical gap between the trigger and the popover (in px). */
const ANCHOR_GAP = 10;
/** Minimum distance the popover must keep from the viewport edges (in px). */
const VIEWPORT_PADDING = 8;

/**
 * Compute the popover position from the anchor and popover bounding rects,
 * with auto-flip (top/bottom) and auto-shift (clamped to viewport horizontally).
 * Mirrors {@link AuthRequiredPopover}'s `computePosition`.
 */
function computePosition(
    anchorRect: DOMRect,
    popoverRect: { width: number; height: number },
    viewport: { width: number; height: number }
): PopoverPosition {
    const spaceBelow = viewport.height - anchorRect.bottom;
    const spaceAbove = anchorRect.top;
    const needed = popoverRect.height + ANCHOR_GAP + VIEWPORT_PADDING;

    const placement: 'bottom' | 'top' =
        spaceBelow < needed && spaceAbove > spaceBelow ? 'top' : 'bottom';

    const top =
        placement === 'bottom'
            ? anchorRect.bottom + ANCHOR_GAP
            : anchorRect.top - popoverRect.height - ANCHOR_GAP;

    let left = anchorRect.right - popoverRect.width;

    const minLeft = VIEWPORT_PADDING;
    const maxLeft = viewport.width - popoverRect.width - VIEWPORT_PADDING;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    const anchorCenterX = anchorRect.left + anchorRect.width / 2;
    const rawArrowLeft = anchorCenterX - left;
    const arrowMin = 12;
    const arrowMax = popoverRect.width - 12;
    const arrowLeft = Math.max(arrowMin, Math.min(arrowMax, rawArrowLeft));

    return { top, left, arrowLeft, placement };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CompareUpsellPopover displays a contextual upgrade prompt for authenticated
 * users whose plan lacks the comparison entitlement.
 *
 * Renders via Portal to `document.body` with `position: fixed`, so it is never
 * clipped by an ancestor `overflow: hidden` and never affects the parent layout.
 *
 * @example
 * ```tsx
 * const buttonRef = useRef<HTMLButtonElement>(null);
 * <button ref={buttonRef} onClick={() => setOpen(true)}>...</button>
 * {open && (
 *   <CompareUpsellPopover
 *     anchorRef={buttonRef}
 *     message="Tu plan no incluye la comparación de alojamientos."
 *     ctaLabel="Ver planes"
 *     ctaHref="/es/suscriptores/planes/"
 *     onClose={() => setOpen(false)}
 *     dialogLabel="Función no disponible en tu plan"
 *     closeLabel="Cerrar"
 *   />
 * )}
 * ```
 */
export function CompareUpsellPopover({
    anchorRef,
    message,
    ctaLabel,
    ctaHref,
    onClose,
    className = '',
    dialogLabel,
    closeLabel
}: CompareUpsellPopoverProps): JSX.Element | null {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState<PopoverPosition | null>(null);
    // Render only after mount to support SSR (document is undefined on the server).
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Position the popover relative to the anchor, then animate it in.
    // Repositions on resize. Scroll dismisses the popover (capture: true catches
    // ancestor scrolls too) so it does not visually detach from the trigger as
    // the page scrolls underneath.
    useLayoutEffect(() => {
        if (!mounted) return;
        const anchor = anchorRef.current;
        const popover = popoverRef.current;
        if (!anchor || !popover) return;

        const update = (): void => {
            const anchorRect = anchor.getBoundingClientRect();
            const popoverRect = {
                width: popover.offsetWidth,
                height: popover.offsetHeight
            };
            const viewport = {
                width: window.innerWidth,
                height: window.innerHeight
            };
            setPosition(computePosition(anchorRect, popoverRect, viewport));
        };

        update();
        const frame = requestAnimationFrame(() => setIsVisible(true));

        const handleScroll = (): void => onClose();

        window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
        window.addEventListener('resize', update, { passive: true });

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', handleScroll, { capture: true });
            window.removeEventListener('resize', update);
        };
    }, [mounted, anchorRef, onClose]);

    // Close on Escape key.
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Close on click outside the popover (also ignore clicks on the anchor itself
    // so toggling via the trigger does not immediately re-close).
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent): void => {
            const target = event.target as Node;
            if (popoverRef.current?.contains(target)) return;
            if (anchorRef.current?.contains(target)) return;
            onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, anchorRef]);

    if (!mounted) return null;

    const popoverNode = (
        <div
            ref={popoverRef}
            // biome-ignore lint/a11y/useSemanticElements: Using div with role="dialog" for a non-modal popover
            role="dialog"
            aria-label={dialogLabel}
            className={cn(
                styles.popover,
                isVisible && position ? styles.popoverVisible : styles.popoverHidden,
                className
            )}
            style={{
                top: position ? `${position.top}px` : 0,
                left: position ? `${position.left}px` : 0
            }}
            data-placement={position?.placement ?? 'bottom'}
        >
            {/* Arrow pointing toward the trigger */}
            <div
                aria-hidden="true"
                className={styles.arrow}
                style={{ left: position ? `${position.arrowLeft}px` : undefined }}
            />

            {/* Close button */}
            <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className={styles.closeButton}
            >
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                >
                    <path
                        d="M9 3L3 9M3 3l6 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                </svg>
            </button>

            {/* Header strip with icon and message */}
            <div className={styles.header}>
                <div className={styles.iconWrapper}>
                    <CrownIcon
                        size={16}
                        weight="duotone"
                        aria-hidden="true"
                    />
                </div>
                <p className={styles.message}>{message}</p>
            </div>

            {/* Single call-to-action */}
            <div className={styles.actions}>
                <a
                    href={ctaHref}
                    className={styles.ctaButton}
                >
                    {ctaLabel}
                </a>
            </div>
        </div>
    );

    return createPortal(popoverNode, document.body);
}
