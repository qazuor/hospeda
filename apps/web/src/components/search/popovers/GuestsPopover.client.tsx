import {
    autoUpdate,
    flip,
    offset,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useRole
} from '@floating-ui/react';
import type { JSX } from 'react';
import { useCallback, useState } from 'react';
import {
    ADULTS_MAX,
    ADULTS_MIN,
    CHILDREN_MAX,
    CHILDREN_MIN,
    FIELD_TRIGGER,
    FOCUS_RING,
    POPOVER_BASE
} from '../search-bar-constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GuestsPopoverProps {
    readonly adults: number;
    readonly childrenCount: number;
    readonly onAdultsChange: (value: number) => void;
    readonly onChildrenChange: (value: number) => void;
    readonly adultsLabel: string;
    readonly childrenLabel: string;
    readonly guestsPlaceholder: string;
    readonly guestsSummary: string;
    readonly isMobile?: boolean;
}

// ---------------------------------------------------------------------------
// Stepper row
// ---------------------------------------------------------------------------

function StepperRow({
    label,
    value,
    min,
    max,
    onChange
}: {
    readonly label: string;
    readonly value: number;
    readonly min: number;
    readonly max: number;
    readonly onChange: (v: number) => void;
}): JSX.Element {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-text">{label}</span>
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(min, value - 1))}
                    disabled={value <= min}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border border-border text-text transition-colors hover:bg-primary-50/50 disabled:opacity-30 ${FOCUS_RING}`}
                    aria-label={`Decrease ${label}`}
                >
                    -
                </button>
                <span
                    className="w-6 text-center font-medium text-sm text-text tabular-nums"
                    role="spinbutton"
                    tabIndex={0}
                    aria-valuenow={value}
                    aria-valuemin={min}
                    aria-valuemax={max}
                    aria-label={label}
                >
                    {value}
                </span>
                <button
                    type="button"
                    onClick={() => onChange(Math.min(max, value + 1))}
                    disabled={value >= max}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border border-border text-text transition-colors hover:bg-primary-50/50 disabled:opacity-30 ${FOCUS_RING}`}
                    aria-label={`Increase ${label}`}
                >
                    +
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Guest selector popover with stepper controls for adults and children.
 * Uses @floating-ui/react for desktop; renders inline on mobile.
 */
export function GuestsPopover({
    adults,
    childrenCount,
    onAdultsChange,
    onChildrenChange,
    adultsLabel,
    childrenLabel,
    guestsPlaceholder,
    guestsSummary,
    isMobile = false
}: GuestsPopoverProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: 'bottom-start',
        middleware: [offset(8), flip(), shift({ padding: 8 })],
        whileElementsMounted: autoUpdate
    });

    const click = useClick(context);
    const dismiss = useDismiss(context);
    const role = useRole(context, { role: 'dialog' });
    const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

    const handleAdultsChange = useCallback((v: number) => onAdultsChange(v), [onAdultsChange]);

    const handleChildrenChange = useCallback(
        (v: number) => onChildrenChange(v),
        [onChildrenChange]
    );

    // Build summary text: replace {adults} and {children} placeholders
    const summary =
        childrenCount > 0
            ? guestsSummary
                  .replace('{adults}', String(adults))
                  .replace('{children}', String(childrenCount))
            : `${adults} ${adultsLabel.toLowerCase()}`;

    const panel = (
        <div
            className={`${isMobile ? '' : POPOVER_BASE} flex flex-col gap-4 ${isMobile ? 'py-2' : 'min-w-[240px]'}`}
        >
            <StepperRow
                label={adultsLabel}
                value={adults}
                min={ADULTS_MIN}
                max={ADULTS_MAX}
                onChange={handleAdultsChange}
            />
            <StepperRow
                label={childrenLabel}
                value={childrenCount}
                min={CHILDREN_MIN}
                max={CHILDREN_MAX}
                onChange={handleChildrenChange}
            />
        </div>
    );

    if (isMobile) {
        return (
            <div className="flex flex-col gap-2">
                <span className="font-semibold text-text-secondary text-xs uppercase tracking-wide">
                    {guestsPlaceholder}
                </span>
                {panel}
            </div>
        );
    }

    return (
        <>
            <button
                ref={refs.setReference}
                type="button"
                className={`${FIELD_TRIGGER} ${FOCUS_RING}`}
                aria-expanded={isOpen}
                {...getReferenceProps()}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 256 256"
                    fill="currentColor"
                    aria-hidden="true"
                >
                    <path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,49.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z" />
                </svg>
                <span className="truncate text-text">{summary}</span>
            </button>

            {isOpen && (
                <div
                    ref={refs.setFloating}
                    style={floatingStyles}
                    className="z-50"
                    {...getFloatingProps()}
                >
                    {panel}
                </div>
            )}
        </>
    );
}
