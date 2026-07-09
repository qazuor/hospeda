/**
 * @file CountryCodeCombobox.client.tsx
 * @description Accessible searchable combobox for picking a phone country
 * code (BETA-144 design review, item 5). Replaces the previous
 * `<input list>` + `<datalist>` selector in `ContactInfoSection`, which
 * rendered as a plain text field with no visible dropdown affordance.
 *
 * UX: a trigger button shows the current selection (e.g. "Argentina (+54)")
 * with a chevron affordance. Activating it (click, Enter, Space, or
 * ArrowDown) opens a popover with an autofocused search input that filters
 * the curated `PHONE_COUNTRIES` list by name or dial code, and a
 * `role="listbox"` of matching options below.
 *
 * The popover portals to `document.body` (mirrors the pattern in
 * `shared/filters/components/SortPopover.tsx`) because the accommodation
 * editor's `.card` container sets `overflow: hidden`, which would otherwise
 * clip the dropdown.
 *
 * Keyboard: ArrowUp/Down move the active option (virtual focus via
 * `aria-activedescendant` — real DOM focus stays on the search input so
 * typing keeps working while navigating), Enter selects, Escape closes and
 * returns focus to the trigger. Click-outside closes without moving focus.
 */

import { ChevronDownIcon, SearchIcon } from '@repo/icons';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    flagEmoji,
    formatPhoneCountryLabel,
    PHONE_COUNTRIES,
    type PhoneCountry
} from '@/lib/phone-countries';
import styles from './CountryCodeCombobox.module.css';

/** Props for {@link CountryCodeCombobox}. */
export interface CountryCodeComboboxProps {
    /** Active locale (drives translated labels). */
    readonly locale: SupportedLocale;
    /** DOM id for the trigger button — lets an external `<label for>` target it. */
    readonly id?: string;
    /** Currently selected country. */
    readonly value: PhoneCountry;
    /** Fired with the newly selected country when the user picks one. */
    readonly onChange: (country: PhoneCountry) => void;
    /** Disables the trigger. */
    readonly disabled?: boolean;
}

/** Computed fixed position for the portal-mounted popover. */
interface PopoverPosition {
    readonly top: number;
    readonly left: number;
    readonly width: number;
}

/** Minimum gap (px) between the popover edge and the viewport boundary. */
const VIEWPORT_MARGIN = 8;
/** Gap (px) between the trigger bottom and the popover top. */
const TRIGGER_GAP = 4;
/** Floor width (px) for the popover, even if the trigger itself is narrow. */
const MIN_POPOVER_WIDTH = 240;

/**
 * Computes the fixed position for the popover, anchored to the trigger and
 * clamped so it never overflows the viewport horizontally.
 */
function computePosition(triggerEl: HTMLButtonElement): PopoverPosition {
    const rect = triggerEl.getBoundingClientRect();
    const width = Math.max(rect.width, MIN_POPOVER_WIDTH);
    const maxLeft = Math.max(window.innerWidth - width - VIEWPORT_MARGIN, VIEWPORT_MARGIN);
    const left = Math.min(Math.max(rect.left, VIEWPORT_MARGIN), maxLeft);
    return { top: rect.bottom + TRIGGER_GAP, left, width };
}

/** Case-insensitive filter by country name or dial code (with or without `+`). */
function filterCountries(query: string): readonly PhoneCountry[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter((country) => {
        const dial = country.dialCode.toLowerCase();
        return (
            country.name.toLowerCase().includes(needle) ||
            dial.includes(needle) ||
            dial.replace('+', '').includes(needle)
        );
    });
}

/**
 * Searchable phone country-code combobox. See file header for the full
 * interaction contract.
 */
export function CountryCodeCombobox({
    locale,
    id,
    value,
    onChange,
    disabled = false
}: CountryCodeComboboxProps) {
    const { t } = createTranslations(locale);

    const generatedId = useId();
    const triggerId = id ?? `country-code-combobox-${generatedId}`;
    const listboxId = `${triggerId}-listbox`;
    const searchInputId = `${triggerId}-search`;

    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [pos, setPos] = useState<PopoverPosition>({ top: 0, left: 0, width: MIN_POPOVER_WIDTH });

    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const optionRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

    const results = useMemo(() => filterCountries(query), [query]);

    const reposition = useCallback(() => {
        if (!triggerRef.current) return;
        setPos(computePosition(triggerRef.current));
    }, []);

    const openPopover = useCallback(() => {
        if (disabled) return;
        reposition();
        setQuery('');
        const currentIndex = PHONE_COUNTRIES.findIndex((country) => country.iso === value.iso);
        setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
        setIsOpen(true);
    }, [disabled, reposition, value.iso]);

    const closePopover = useCallback((refocusTrigger: boolean) => {
        setIsOpen(false);
        if (refocusTrigger) {
            triggerRef.current?.focus();
        }
    }, []);

    const handleSelect = useCallback(
        (country: PhoneCountry) => {
            onChange(country);
            closePopover(true);
        },
        [onChange, closePopover]
    );

    const handleQueryChange = useCallback((nextQuery: string) => {
        setQuery(nextQuery);
        const filtered = filterCountries(nextQuery);
        setHighlightedIndex(filtered.length > 0 ? 0 : -1);
    }, []);

    // Autofocus the search input as soon as the popover opens.
    useEffect(() => {
        if (isOpen) {
            searchInputRef.current?.focus();
        }
    }, [isOpen]);

    // Reposition on resize/scroll while open (mirrors SortPopover.tsx).
    useEffect(() => {
        if (!isOpen) return;
        window.addEventListener('resize', reposition, { passive: true });
        window.addEventListener('scroll', reposition, { passive: true });
        return () => {
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition);
        };
    }, [isOpen, reposition]);

    // Close on click outside the trigger or the portaled popover.
    useEffect(() => {
        if (!isOpen) return;
        function handleMouseDown(event: MouseEvent): void {
            const target = event.target as Node;
            if (triggerRef.current?.contains(target)) return;
            if (popoverRef.current?.contains(target)) return;
            setIsOpen(false);
        }
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [isOpen]);

    // Keep the highlighted option scrolled into view during keyboard nav.
    // `scrollIntoView` is absent in jsdom (test environment) — guard the call.
    useEffect(() => {
        if (!isOpen) return;
        const el = optionRefs.current.get(highlightedIndex);
        if (el && typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ block: 'nearest' });
        }
    }, [isOpen, highlightedIndex]);

    const handleTriggerKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLButtonElement>) => {
            if (event.key === 'ArrowDown' && !isOpen) {
                event.preventDefault();
                openPopover();
            }
        },
        [isOpen, openPopover]
    );

    const handleSearchKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (results.length === 0) return;
                setHighlightedIndex((prev) => (prev + 1) % results.length);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (results.length === 0) return;
                setHighlightedIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                const target = results[highlightedIndex];
                if (target) handleSelect(target);
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                closePopover(true);
            }
        },
        [results, highlightedIndex, handleSelect, closePopover]
    );

    const activeOptionId = useMemo(() => {
        const active = results[highlightedIndex];
        return active ? `${listboxId}-option-${active.iso}` : undefined;
    }, [results, highlightedIndex, listboxId]);

    const noResultsLabel = t(
        'host.properties.editor.field.phoneCountryNoResults',
        'No se encontraron países'
    );
    const fieldLabel = t('host.properties.editor.field.phoneCountry', 'País');
    const selectedLabel = formatPhoneCountryLabel(value);

    return (
        <>
            <button
                ref={triggerRef}
                id={triggerId}
                type="button"
                className={cn(styles.trigger, disabled && styles.triggerDisabled)}
                onClick={() => (isOpen ? closePopover(false) : openPopover())}
                onKeyDown={handleTriggerKeyDown}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={listboxId}
                // The external <label for> in ContactInfoSection would otherwise
                // WIN the accessible-name computation over this button's own text
                // content, so a screen reader would announce just "País" with no
                // indication of the current selection. An explicit aria-label
                // (which takes precedence) fixes that while still leading with
                // the field name, satisfying WCAG 2.5.3 Label in Name.
                aria-label={`${fieldLabel}: ${selectedLabel}`}
            >
                <span className={styles.triggerLabel}>
                    <span
                        className={styles.triggerFlag}
                        aria-hidden="true"
                    >
                        {flagEmoji(value.iso)}
                    </span>
                    <span className={styles.triggerLabelText}>{selectedLabel}</span>
                </span>
                <ChevronDownIcon
                    size={16}
                    weight="regular"
                    aria-hidden="true"
                    className={cn(styles.chevron, isOpen && styles.chevronOpen)}
                />
            </button>

            {isOpen &&
                createPortal(
                    <div
                        ref={popoverRef}
                        className={cn(styles.popover, 'overlay-surface')}
                        style={{
                            top: `${pos.top}px`,
                            left: `${pos.left}px`,
                            width: `${pos.width}px`
                        }}
                    >
                        <div className={styles.searchWrap}>
                            <SearchIcon
                                size={16}
                                weight="regular"
                                aria-hidden="true"
                                className={styles.searchIcon}
                            />
                            <input
                                ref={searchInputRef}
                                id={searchInputId}
                                type="text"
                                role="combobox"
                                className={styles.searchInput}
                                value={query}
                                onChange={(event) => handleQueryChange(event.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                placeholder={t(
                                    'host.properties.editor.field.phoneCountrySearchPlaceholder',
                                    'Buscar país...'
                                )}
                                autoComplete="off"
                                aria-expanded="true"
                                aria-controls={listboxId}
                                aria-autocomplete="list"
                                aria-activedescendant={activeOptionId}
                                aria-label={t('host.properties.editor.field.phoneCountry', 'País')}
                            />
                        </div>

                        <div
                            id={listboxId}
                            role="listbox"
                            aria-label={t('host.properties.editor.field.phoneCountry', 'País')}
                            className={styles.listbox}
                        >
                            {results.length === 0 ? (
                                <div className={styles.emptyState}>{noResultsLabel}</div>
                            ) : (
                                results.map((country, index) => {
                                    const optionId = `${listboxId}-option-${country.iso}`;
                                    const isSelected = country.iso === value.iso;
                                    const isHighlighted = index === highlightedIndex;
                                    return (
                                        <button
                                            key={country.iso}
                                            id={optionId}
                                            type="button"
                                            ref={(el) => {
                                                if (el) optionRefs.current.set(index, el);
                                                else optionRefs.current.delete(index);
                                            }}
                                            role="option"
                                            aria-selected={isSelected}
                                            className={cn(
                                                styles.option,
                                                isHighlighted && styles.optionHighlighted,
                                                isSelected && styles.optionSelected
                                            )}
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                handleSelect(country);
                                            }}
                                            onMouseEnter={() => setHighlightedIndex(index)}
                                        >
                                            <span className={styles.optionName}>
                                                <span
                                                    className={styles.optionFlag}
                                                    aria-hidden="true"
                                                >
                                                    {flagEmoji(country.iso)}
                                                </span>
                                                <span className={styles.optionNameText}>
                                                    {country.name}
                                                </span>
                                            </span>
                                            <span className={styles.optionDial}>
                                                {country.dialCode}
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
