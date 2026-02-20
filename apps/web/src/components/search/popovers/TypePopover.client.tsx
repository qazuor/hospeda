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
import type { AccommodationTypeEnum } from '@repo/schemas';
import { Command } from 'cmdk';
import type { JSX } from 'react';
import { useCallback, useState } from 'react';
import { ACCOMMODATION_TYPE_OPTIONS, FIELD_TRIGGER, FOCUS_RING } from '../search-bar-constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TypePopoverProps {
    readonly selected: readonly AccommodationTypeEnum[];
    readonly onToggle: (type: AccommodationTypeEnum) => void;
    readonly typeLabels: Readonly<Record<AccommodationTypeEnum, string>>;
    readonly typePlaceholder: string;
    readonly isMobile?: boolean;
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
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-gray-300 bg-white" />
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
 * Keyboard: arrows navigate, Space toggles item, Enter closes.
 */
function TypeList({
    selected,
    onToggle,
    typeLabels,
    typePlaceholder,
    onClose
}: {
    readonly selected: readonly AccommodationTypeEnum[];
    readonly onToggle: (type: AccommodationTypeEnum) => void;
    readonly typeLabels: Readonly<Record<AccommodationTypeEnum, string>>;
    readonly typePlaceholder: string;
    readonly onClose?: () => void;
}): JSX.Element {
    /**
     * Keyboard handling (capture phase to intercept before cmdk):
     * - Space: toggle highlighted item
     * - Enter: close popover accepting selection
     * - Arrows: navigate (cmdk built-in)
     */
    const handleKeyDownCapture = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === ' ') {
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
            label={typePlaceholder}
            onKeyDownCapture={handleKeyDownCapture}
        >
            {/* Visually hidden input for cmdk keyboard navigation */}
            <Command.Input
                autoFocus
                className="absolute h-0 w-0 overflow-hidden opacity-0"
            />
            <Command.List className="py-1">
                {ACCOMMODATION_TYPE_OPTIONS.map(({ value, emoji }) => {
                    const isSelected = selected.includes(value);
                    return (
                        <Command.Item
                            key={value}
                            value={typeLabels[value]}
                            onSelect={() => onToggle(value)}
                            className={`data-[selected=true]:-outline-offset-2 flex cursor-pointer items-center gap-3 border-gray-100 border-t px-4 py-3 text-sm transition-colors first:border-t-0 data-[selected=true]:bg-primary/8 data-[selected=true]:outline data-[selected=true]:outline-2 data-[selected=true]:outline-primary/30 ${isSelected ? 'text-primary' : 'text-gray-700'}
                            `}
                        >
                            <Checkbox checked={isSelected} />
                            <span
                                aria-hidden="true"
                                className="text-base"
                            >
                                {emoji}
                            </span>
                            <span className={`flex-1 truncate ${isSelected ? 'font-medium' : ''}`}>
                                {typeLabels[value]}
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
 * Multi-select accommodation type popover.
 * Dribbble-inspired design: checkbox items, check icon on right.
 * Keyboard: arrows navigate, Space toggles, Enter closes.
 */
export function TypePopover({
    selected,
    onToggle,
    typeLabels,
    typePlaceholder,
    isMobile = false
}: TypePopoverProps): JSX.Element {
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

    const handleToggle = useCallback(
        (type: AccommodationTypeEnum) => {
            onToggle(type);
        },
        [onToggle]
    );

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    const firstSelectedLabel =
        selected.length > 0 ? typeLabels[selected[0] as AccommodationTypeEnum] : '';

    const summary =
        selected.length === 0
            ? typePlaceholder
            : selected.length === 1
              ? firstSelectedLabel
              : `${firstSelectedLabel} & ${selected.length - 1} more`;

    if (isMobile) {
        return (
            <div className="flex flex-col gap-2">
                <span className="font-semibold text-text-secondary text-xs uppercase tracking-wide">
                    {typePlaceholder}
                </span>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <TypeList
                        selected={selected}
                        onToggle={handleToggle}
                        typeLabels={typeLabels}
                        typePlaceholder={typePlaceholder}
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
                    <path d="M218.83,103.77l-80-75.48a1.14,1.14,0,0,1-.11-.11,16,16,0,0,0-21.53,0l-.11.11L37.17,103.77A16,16,0,0,0,32,115.55V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V160h32v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V115.55A16,16,0,0,0,218.83,103.77ZM208,208H160V160a16,16,0,0,0-16-16H112a16,16,0,0,0-16,16v48H48V115.55l.11-.1L128,40l79.9,75.43.11.1Z" />
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
                    <div className="min-w-[280px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                        <TypeList
                            selected={selected}
                            onToggle={handleToggle}
                            typeLabels={typeLabels}
                            typePlaceholder={typePlaceholder}
                            onClose={handleClose}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
