import type { AccommodationTypeEnum } from '@repo/schemas';
import type { JSX } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import type { SupportedLocale } from '../../lib/i18n';
import { DateRangePopover } from './popovers/DateRangePopover.client';
import { DestinationPopover } from './popovers/DestinationPopover.client';
import { GuestsPopover } from './popovers/GuestsPopover.client';
import { TypePopover } from './popovers/TypePopover.client';
import { FOCUS_RING } from './search-bar-constants';
import type { DestinationOption, HeroSearchBarLabels, SearchFormState } from './search-bar-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchBottomSheetProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onSubmit: () => void;
    readonly formState: SearchFormState;
    readonly destinations: readonly DestinationOption[];
    readonly isLoadingDestinations: boolean;
    readonly labels: HeroSearchBarLabels;
    readonly locale: SupportedLocale;
    readonly onDestinationToggle: (id: string) => void;
    readonly onTypeToggle: (type: AccommodationTypeEnum) => void;
    readonly onCheckInChange: (value: string) => void;
    readonly onCheckOutChange: (value: string) => void;
    readonly onAdultsChange: (value: number) => void;
    readonly onChildrenChange: (value: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Mobile bottom sheet wrapping the 4 search popovers in stacked layout.
 * Uses `<dialog>` with showModal/close for native backdrop + Escape handling.
 */
export function SearchBottomSheet({
    isOpen,
    onClose,
    onSubmit,
    formState,
    destinations,
    isLoadingDestinations,
    labels,
    locale,
    onDestinationToggle,
    onTypeToggle,
    onCheckInChange,
    onCheckOutChange,
    onAdultsChange,
    onChildrenChange
}: SearchBottomSheetProps): JSX.Element | null {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (isOpen && !dialog.open) {
            dialog.showModal();
        } else if (!isOpen && dialog.open) {
            dialog.close();
        }
    }, [isOpen]);

    // Close on backdrop click
    const handleDialogClick = useCallback(
        (e: React.MouseEvent<HTMLDialogElement>) => {
            if (e.target === dialogRef.current) {
                onClose();
            }
        },
        [onClose]
    );

    // Handle native close event (Escape key)
    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);

    return (
        <dialog
            ref={dialogRef}
            onClick={handleDialogClick}
            onKeyDown={(e) => {
                if (e.key === 'Escape') handleClose();
            }}
            onClose={handleClose}
            className="fixed inset-0 m-0 max-h-[90svh] w-full max-w-full translate-y-[10svh] rounded-t-3xl border-0 bg-surface p-0 shadow-2xl backdrop:bg-black/50"
            aria-label={labels.searchAriaLabel}
        >
            <div className="flex h-full flex-col">
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-2">
                    <div
                        className="h-1 w-10 rounded-full bg-border"
                        aria-hidden="true"
                    />
                </div>

                {/* Close button */}
                <div className="flex justify-end px-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-primary-50/50 ${FOCUS_RING}`}
                        aria-label={labels.closePanelAriaLabel}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 256 256"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-5 pb-4">
                    <div className="flex flex-col gap-6">
                        <DestinationPopover
                            destinations={destinations}
                            selected={formState.destinations as string[]}
                            onToggle={onDestinationToggle}
                            isLoading={isLoadingDestinations}
                            destinationPlaceholder={labels.destinationPlaceholder}
                            loadingText={labels.loadingText}
                            isMobile
                            locale={locale}
                        />
                        <TypePopover
                            selected={formState.types}
                            onToggle={onTypeToggle}
                            typeLabels={labels.typeLabels}
                            typePlaceholder={labels.typePlaceholder}
                            isMobile
                            locale={locale}
                        />
                        <DateRangePopover
                            checkIn={formState.checkIn}
                            checkOut={formState.checkOut}
                            onCheckInChange={onCheckInChange}
                            onCheckOutChange={onCheckOutChange}
                            locale={locale}
                            checkInLabel={labels.checkInLabel}
                            checkOutLabel={labels.checkOutLabel}
                            datesPlaceholder={labels.datesPlaceholder}
                            isMobile
                        />
                        <GuestsPopover
                            adults={formState.adults}
                            childrenCount={formState.children}
                            onAdultsChange={onAdultsChange}
                            onChildrenChange={onChildrenChange}
                            adultsLabel={labels.adultsLabel}
                            childrenLabel={labels.childrenLabel}
                            guestsPlaceholder={labels.guestsPlaceholder}
                            guestsSummary={labels.guestsSummary}
                            isMobile
                        />
                    </div>
                </div>

                {/* Search button */}
                <div className="border-border border-t px-5 pt-4 pb-6">
                    <button
                        type="button"
                        onClick={onSubmit}
                        className={`w-full rounded-2xl bg-primary px-6 py-3.5 font-semibold text-white transition-colors hover:bg-primary-dark ${FOCUS_RING}`}
                    >
                        {labels.ctaLabel}
                    </button>
                </div>
            </div>
        </dialog>
    );
}
