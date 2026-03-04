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
import { formatDate } from '@repo/i18n';
import type { JSX } from 'react';
import { useCallback, useRef, useState } from 'react';
import { FIELD_TRIGGER, FOCUS_RING, POPOVER_BASE } from '../search-bar-constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DateRangePopoverProps {
    readonly checkIn: string;
    readonly checkOut: string;
    readonly onCheckInChange: (value: string) => void;
    readonly onCheckOutChange: (value: string) => void;
    readonly locale: string;
    readonly checkInLabel: string;
    readonly checkOutLabel: string;
    readonly datesPlaceholder: string;
    readonly isMobile?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateShort({
    date,
    locale
}: { readonly date: string; readonly locale: string }): string {
    if (!date) return '';
    try {
        // Parse YYYY-MM-DD parts to avoid UTC timezone shift
        const [year, month, day] = date.split('-').map(Number);
        const local = new Date(year as number, (month as number) - 1, day);
        return formatDate({ date: local, locale, options: { day: 'numeric', month: 'short' } });
    } catch {
        return date;
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Date range popover with two native date inputs.
 * Uses @floating-ui/react for desktop positioning.
 * Renders inline when `isMobile` is true.
 */
export function DateRangePopover({
    checkIn,
    checkOut,
    onCheckInChange,
    onCheckOutChange,
    locale,
    checkInLabel,
    checkOutLabel,
    datesPlaceholder,
    isMobile = false
}: DateRangePopoverProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);
    const checkOutRef = useRef<HTMLInputElement>(null);

    const todayIso = new Date().toISOString().split('T')[0] as string;

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

    const handleCheckInChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newCheckIn = e.target.value;
            onCheckInChange(newCheckIn);
            // If check-out is now before check-in, reset it
            if (checkOut && newCheckIn > checkOut) {
                onCheckOutChange('');
            }
            // Auto-focus checkout after selecting check-in
            setTimeout(() => checkOutRef.current?.focus(), 50);
        },
        [onCheckInChange, onCheckOutChange, checkOut]
    );

    const handleCheckOutChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newCheckOut = e.target.value;
            // Only accept if check-out is on or after check-in
            if (checkIn && newCheckOut < checkIn) {
                return;
            }
            onCheckOutChange(newCheckOut);
            if (!isMobile) setIsOpen(false);
        },
        [onCheckOutChange, isMobile, checkIn]
    );

    // Summary text for trigger
    const summary =
        checkIn && checkOut
            ? `${formatDateShort({ date: checkIn, locale })} \u2192 ${formatDateShort({ date: checkOut, locale })}`
            : checkIn
              ? formatDateShort({ date: checkIn, locale })
              : datesPlaceholder;

    const panel = (
        <div
            className={`${isMobile ? '' : POPOVER_BASE} flex flex-col gap-3 ${isMobile ? 'py-2' : 'min-w-[260px]'}`}
        >
            <div className="flex flex-col gap-1">
                <label
                    htmlFor="search-checkin"
                    className="font-medium text-text-secondary text-xs"
                >
                    {checkInLabel}
                </label>
                <input
                    id="search-checkin"
                    type="date"
                    value={checkIn}
                    min={todayIso}
                    onChange={handleCheckInChange}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:[color-scheme:dark]"
                />
            </div>
            <div className="flex flex-col gap-1">
                <label
                    htmlFor="search-checkout"
                    className="font-medium text-text-secondary text-xs"
                >
                    {checkOutLabel}
                </label>
                <input
                    ref={checkOutRef}
                    id="search-checkout"
                    type="date"
                    value={checkOut}
                    min={checkIn || todayIso}
                    onChange={handleCheckOutChange}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:[color-scheme:dark]"
                />
            </div>
        </div>
    );

    // Mobile: render inline, no floating
    if (isMobile) {
        return (
            <div className="flex flex-col gap-2">
                <span className="font-semibold text-text-secondary text-xs uppercase tracking-wide">
                    {datesPlaceholder}
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
                    <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM48,48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48ZM208,208H48V96H208V208Z" />
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
