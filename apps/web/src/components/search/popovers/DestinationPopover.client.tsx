import {
    autoUpdate,
    flip,
    offset,
    shift,
    size,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useRole
} from '@floating-ui/react';
import { Command } from 'cmdk';
import type { JSX } from 'react';
import { useCallback, useState } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import type { SupportedLocale } from '../../../lib/i18n';
import { FIELD_TRIGGER, FOCUS_RING } from '../search-bar-constants';
import type { DestinationOption } from '../search-bar-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DestinationPopoverProps {
    readonly destinations: readonly DestinationOption[];
    readonly selected: readonly string[];
    readonly onToggle: (id: string) => void;
    readonly isLoading: boolean;
    readonly destinationPlaceholder: string;
    readonly loadingText: string;
    readonly isMobile?: boolean;
    readonly locale?: SupportedLocale;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonRow(): JSX.Element {
    return (
        <div className="flex animate-pulse items-center gap-3 px-4 py-3">
            <div className="h-5 w-5 rounded bg-surface-alt dark:bg-surface-elevated" />
            <div className="h-4 flex-1 rounded bg-surface-alt dark:bg-surface-elevated" />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Checkbox icon
// ---------------------------------------------------------------------------

function Checkbox({ checked }: { readonly checked: boolean }): JSX.Element {
    if (checked) {
        return (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-white">
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                >
                    <path
                        d="M2.5 6L5 8.5L9.5 3.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </span>
        );
    }
    return (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-border bg-surface" />
    );
}

// ---------------------------------------------------------------------------
// Keyboard helper
// ---------------------------------------------------------------------------

function toggleHighlightedItem(container: HTMLElement): void {
    const highlighted = container.querySelector<HTMLElement>('[cmdk-item][data-selected="true"]');
    if (highlighted) {
        highlighted.click();
    }
}

// ---------------------------------------------------------------------------
// Shared list content
// ---------------------------------------------------------------------------

/**
 * Keyboard: arrows navigate, Enter toggles item, Escape closes.
 * Typing in the search input filters the list.
 */
function DestinationList({
    destinations,
    selected,
    onToggle,
    isLoading,
    destinationPlaceholder,
    loadingText,
    onClose
}: {
    readonly destinations: readonly DestinationOption[];
    readonly selected: readonly string[];
    readonly onToggle: (id: string) => void;
    readonly isLoading: boolean;
    readonly destinationPlaceholder: string;
    readonly loadingText: string;
    readonly onClose?: () => void;
}): JSX.Element {
    if (isLoading) {
        return (
            <div className="flex flex-col">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
            </div>
        );
    }

    /**
     * Keyboard handling (capture phase to intercept before cmdk):
     * - Space: toggle highlighted item (only when focus is NOT in the search input)
     * - Enter: close popover accepting selection
     * - Arrows: navigate (cmdk built-in)
     * - Typing: filters list (cmdk built-in via search input)
     */
    const handleKeyDownCapture = useCallback(
        (e: React.KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInInput = target.tagName === 'INPUT';

            if (e.key === ' ' && !isInInput) {
                e.preventDefault();
                e.stopPropagation();
                toggleHighlightedItem(e.currentTarget as HTMLElement);
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                onClose?.();
            }
        },
        [onClose]
    );

    return (
        <Command
            className="flex flex-col"
            label={destinationPlaceholder}
            onKeyDownCapture={handleKeyDownCapture}
            shouldFilter
        >
            {/* Search input - pill shape with gray bg */}
            <div className="p-3">
                <div className="flex items-center gap-2 rounded-full bg-surface-alt px-4 py-2">
                    <Command.Input
                        autoFocus
                        placeholder={destinationPlaceholder}
                        className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-tertiary"
                    />
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 256 256"
                        fill="currentColor"
                        className="shrink-0 text-text-tertiary"
                        aria-hidden="true"
                    >
                        <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
                    </svg>
                </div>
            </div>

            <Command.List className="max-h-[280px] overflow-y-auto">
                <Command.Empty className="px-4 py-6 text-center text-sm text-text-tertiary">
                    {loadingText}
                </Command.Empty>
                {destinations.map((dest) => {
                    const isSelected = selected.includes(dest.id);
                    return (
                        <Command.Item
                            key={dest.id}
                            value={dest.name}
                            onSelect={() => onToggle(dest.id)}
                            className={`data-[selected=true]:-outline-offset-2 flex cursor-pointer items-center gap-3 border-border border-t px-4 py-3 text-sm transition-colors data-[selected=true]:bg-primary/8 data-[selected=true]:outline data-[selected=true]:outline-2 data-[selected=true]:outline-primary/30 ${isSelected ? 'text-primary' : 'text-text'}
                            `}
                        >
                            <Checkbox checked={isSelected} />
                            <span className={`flex-1 truncate ${isSelected ? 'font-medium' : ''}`}>
                                {dest.name}
                            </span>
                            {isSelected && (
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 256 256"
                                    fill="currentColor"
                                    className="shrink-0 text-primary"
                                    aria-hidden="true"
                                >
                                    <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                                </svg>
                            )}
                        </Command.Item>
                    );
                })}
            </Command.List>
        </Command>
    );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Multi-select destination combobox with search/autocomplete.
 * Dribbble-inspired design: pill search, checkbox items, check icon on right.
 */
export function DestinationPopover({
    destinations,
    selected,
    onToggle,
    isLoading,
    destinationPlaceholder,
    loadingText,
    isMobile = false,
    locale = 'es'
}: DestinationPopoverProps): JSX.Element {
    const { tPlural } = useTranslation({ locale, namespace: 'home' });
    const [isOpen, setIsOpen] = useState(false);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: 'bottom-start',
        middleware: [
            offset(8),
            flip(),
            shift({ padding: 8 }),
            size({
                apply({ availableHeight, elements }) {
                    elements.floating.style.maxHeight = `${Math.min(availableHeight - 16, 380)}px`;
                }
            })
        ],
        whileElementsMounted: autoUpdate
    });

    const click = useClick(context);
    const dismiss = useDismiss(context);
    const role = useRole(context, { role: 'dialog' });
    const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

    const handleToggle = useCallback(
        (id: string) => {
            onToggle(id);
        },
        [onToggle]
    );

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    const summary =
        selected.length === 0
            ? isLoading
                ? loadingText
                : destinationPlaceholder
            : selected.length === 1
              ? (destinations.find((d) => d.id === selected[0])?.name ?? destinationPlaceholder)
              : `${destinations.find((d) => d.id === selected[0])?.name ?? ''} ${tPlural('searchBar.moreSelected', selected.length - 1, { count: selected.length - 1 })}`;

    if (isMobile) {
        return (
            <div className="flex flex-col gap-2">
                <span className="font-semibold text-text-secondary text-xs uppercase tracking-wide">
                    {destinationPlaceholder}
                </span>
                <div className="overflow-hidden rounded-xl border border-border bg-surface">
                    <DestinationList
                        destinations={destinations}
                        selected={selected}
                        onToggle={handleToggle}
                        isLoading={isLoading}
                        destinationPlaceholder={destinationPlaceholder}
                        loadingText={loadingText}
                    />
                </div>
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
                disabled={isLoading}
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
                    <path d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z" />
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
                    <div className="min-w-[280px] overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
                        <DestinationList
                            destinations={destinations}
                            selected={selected}
                            onToggle={handleToggle}
                            isLoading={isLoading}
                            destinationPlaceholder={destinationPlaceholder}
                            loadingText={loadingText}
                            onClose={handleClose}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
