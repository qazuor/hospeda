/**
 * @file SortPopover.tsx
 * @description Sort icon button + dropdown popover, mounted via createPortal on
 * document.body to escape overflow:hidden parent containers.
 *
 * Positioning is calculated from the anchor element's bounding rect and clamped
 * to the viewport to avoid overflow on small screens. Repositions on resize and
 * scroll. Closes on outside click, Escape key, or option selection.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './SortPopover.module.css';

/** A single sort option entry. */
export interface SortOption {
    readonly value: string;
    readonly label: string;
}

/** Props for the SortPopover component. */
export interface SortPopoverProps {
    /** Available sort options to display in the dropdown. */
    readonly options: readonly SortOption[];
    /** Currently selected sort value. */
    readonly value: string;
    /** Called when the user selects a sort option. */
    readonly onChange: (value: string) => void;
    /** Locale used to render translated labels. */
    readonly locale: SupportedLocale;
    /**
     * True when this popover is rendered inside the mobile filter drawer.
     * The dropdown portals to `document.body`, so it needs a higher z-index
     * (`--z-popover-in-overlay`) to clear the drawer panel; otherwise the
     * `.overlay-surface` default `--z-popover` would place it behind the
     * drawer. Defaults to false (desktop sidebar → clean `--z-popover`).
     */
    readonly inDrawer?: boolean;
}

/** Computed position for the popover dropdown. */
interface PopoverPosition {
    readonly top: number;
    readonly right: number;
}

/** Minimum gap (px) between the popover edge and the viewport boundary. */
const VIEWPORT_MARGIN = 8;
/** Gap (px) between the trigger bottom and the dropdown top. */
const TRIGGER_GAP = 6;
/** Minimum dropdown width (px) — matches CSS min-width. */
const MIN_DROPDOWN_WIDTH = 200;

/**
 * Calculates the fixed position for the popover dropdown anchored to the trigger.
 * Clamps left/right edges to remain within the viewport.
 */
function computePosition(triggerEl: HTMLButtonElement): PopoverPosition {
    const rect = triggerEl.getBoundingClientRect();
    const top = rect.bottom + TRIGGER_GAP;
    // Right-align with the trigger, clamped to viewport
    const rawRight = window.innerWidth - rect.right;
    const right = Math.max(
        VIEWPORT_MARGIN,
        Math.min(rawRight, window.innerWidth - MIN_DROPDOWN_WIDTH - VIEWPORT_MARGIN)
    );
    return { top, right };
}

/**
 * Sort popover component.
 * Renders a small icon trigger button that opens a dropdown list mounted
 * via `createPortal` on `document.body`, escaping any `overflow:hidden` ancestors.
 *
 * @param props - See {@link SortPopoverProps}.
 */
export function SortPopover({
    options,
    value,
    onChange,
    locale,
    inDrawer = false
}: SortPopoverProps) {
    const { t } = createTranslations(locale);
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<PopoverPosition>({ top: 0, right: 0 });

    /** Recalculates dropdown position from the trigger's bounding rect. */
    const reposition = useCallback(() => {
        if (!triggerRef.current) return;
        setPos(computePosition(triggerRef.current));
    }, []);

    // Position the dropdown when it opens and reposition on resize/scroll
    useEffect(() => {
        if (!isOpen) return;
        reposition();

        window.addEventListener('resize', reposition, { passive: true });
        window.addEventListener('scroll', reposition, { passive: true });
        return () => {
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition);
        };
    }, [isOpen, reposition]);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Close when clicking outside the trigger or dropdown
    useEffect(() => {
        if (!isOpen) return;
        const handleMouseDown = (e: MouseEvent) => {
            if (
                triggerRef.current?.contains(e.target as Node) ||
                dropdownRef.current?.contains(e.target as Node)
            ) {
                return;
            }
            setIsOpen(false);
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [isOpen]);

    const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

    const handleSelect = useCallback(
        (optValue: string) => {
            onChange(optValue);
            setIsOpen(false);
        },
        [onChange]
    );

    return (
        <>
            <button
                type="button"
                ref={triggerRef}
                className={styles.sortPopoverTrigger}
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-label={`${t('ui.filter.sortBy', 'Ordenar por')}: ${selectedLabel}`}
                title={`${t('ui.filter.sortBy', 'Ordenar por')}: ${selectedLabel}`}
            >
                <span
                    className={styles.sortPopoverIcon}
                    aria-hidden="true"
                >
                    ⇅
                </span>
                <span className={styles.sortPopoverLabel}>{t('ui.filter.sort', 'Ordenar')}</span>
            </button>

            {isOpen &&
                createPortal(
                    <>
                        {/* Full-viewport dismiss scrim behind the dropdown.
                            This is a behavior change, not just decoration:
                            because it covers the whole viewport above the
                            page (only the dropdown sits higher), a click
                            anywhere outside the dropdown lands on the scrim
                            and dismisses — dismiss-only, with NO click-
                            through, so clicking a link/button while the
                            dropdown is open closes it without also activating
                            that target (a second click is then needed). The
                            pre-existing document-level click-outside listener
                            still runs; this scrim intercepts the click first
                            by design. */}
                        <div
                            className="overlay-base overlay-scrim"
                            aria-hidden="true"
                            onClick={() => setIsOpen(false)}
                        />
                        <div
                            ref={dropdownRef}
                            className={cn(
                                styles.sortPopoverDropdown,
                                'overlay-surface',
                                inDrawer && styles.sortPopoverDropdownInDrawer
                            )}
                            style={{
                                top: `${pos.top}px`,
                                right: `${pos.right}px`
                            }}
                        >
                            {options.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    className={cn(
                                        styles.sortPopoverOption,
                                        opt.value === value && styles.sortPopoverOptionActive
                                    )}
                                    onClick={() => handleSelect(opt.value)}
                                >
                                    {opt.label}
                                    {opt.value === value && <span aria-hidden="true">✓</span>}
                                </button>
                            ))}
                        </div>
                    </>,
                    document.body
                )}
        </>
    );
}
