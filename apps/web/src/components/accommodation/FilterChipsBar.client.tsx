/**
 * @file FilterChipsBar.client.tsx
 * @description Horizontal bar of filter chips for the accommodations listing page.
 * Toggle chips handle boolean amenity filters (wifi, pool, pets, parking).
 * Dropdown chips handle multi-value filters (type, price range, capacity, rating).
 * Every interaction navigates via URL query params, triggering a server-side re-render
 * without a JS router — preserving all other active filters across navigations.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the FilterChipsBar component */
interface FilterChipsBarProps {
    /** Current query params as key-value pairs, parsed from the URL. */
    readonly currentFilters: Record<string, string>;
    /** Current locale for i18n. */
    readonly locale: string;
    /** Accommodation types available for the type filter dropdown. */
    readonly accommodationTypes: readonly { readonly value: string; readonly label: string }[];
}

// ─── Navigation helpers ───────────────────────────────────────────────────────

/**
 * Navigate to the current page with a new set of query params.
 * Resets the page param on every filter change so the user lands on page 1.
 *
 * @param params - Key-value pairs to set or delete (undefined / empty string = delete).
 */
function navigateWithParams(params: Record<string, string | undefined>): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('page');
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === '') {
            url.searchParams.delete(key);
        } else {
            url.searchParams.set(key, value);
        }
    }
    window.location.href = url.toString();
}

/**
 * Toggle a boolean query param on/off.
 *
 * @param key - The query param name.
 * @param currentFilters - The current active filters.
 */
function toggleBoolParam(key: string, currentFilters: Record<string, string>): void {
    const isActive = currentFilters[key] === 'true';
    navigateWithParams({ [key]: isActive ? undefined : 'true' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Simple on/off chip for boolean filters (wifi, pool, pets, parking).
 */
function ToggleChip({
    label,
    paramKey,
    currentFilters
}: {
    readonly label: string;
    readonly paramKey: string;
    readonly currentFilters: Record<string, string>;
}) {
    const isActive = currentFilters[paramKey] === 'true';
    return (
        <button
            type="button"
            onClick={() => toggleBoolParam(paramKey, currentFilters)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 font-medium text-sm transition-all ${
                isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-text'
            }`}
        >
            {label}
        </button>
    );
}

/**
 * Chip that opens a dropdown popover with interactive filter controls.
 * Closes when clicking outside the popover.
 */
function DropdownChip({
    label,
    isActive,
    children
}: {
    readonly label: string;
    readonly isActive: boolean;
    readonly children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div
            ref={ref}
            className="relative shrink-0"
        >
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 font-medium text-sm transition-all ${
                    isActive
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-text'
                }`}
            >
                {label}
                <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    className={`transition-transform ${open ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                >
                    <path
                        d="M2 3.5L5 6.5L8 3.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </button>
            {open && (
                <div className="absolute top-full left-0 z-30 mt-2 min-w-[240px] rounded-xl border border-border bg-surface p-4 shadow-lg">
                    {children}
                </div>
            )}
        </div>
    );
}

/**
 * Checkbox list for selecting one or more accommodation types.
 */
function TypeFilterContent({
    types,
    currentType
}: {
    readonly types: readonly { readonly value: string; readonly label: string }[];
    readonly currentType?: string;
}) {
    const selectedTypes = currentType ? currentType.split(',') : [];

    const handleToggleType = (value: string) => {
        const newSelected = selectedTypes.includes(value)
            ? selectedTypes.filter((t) => t !== value)
            : [...selectedTypes, value];
        navigateWithParams({ type: newSelected.length > 0 ? newSelected.join(',') : undefined });
    };

    return (
        <div className="flex flex-col gap-2">
            {types.map((t) => (
                <label
                    key={t.value}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                >
                    <input
                        type="checkbox"
                        checked={selectedTypes.includes(t.value)}
                        onChange={() => handleToggleType(t.value)}
                        className="h-4 w-4 rounded border-border text-primary accent-primary"
                    />
                    <span className="text-text">{t.label}</span>
                </label>
            ))}
        </div>
    );
}

/**
 * Min/max numeric inputs for price range filtering.
 */
function PriceFilterContent({
    currentMin,
    currentMax,
    t
}: {
    readonly currentMin?: string;
    readonly currentMax?: string;
    readonly t: (key: string) => string;
}) {
    const [minVal, setMinVal] = useState(currentMin ?? '');
    const [maxVal, setMaxVal] = useState(currentMax ?? '');

    const handleApply = () => {
        navigateWithParams({
            minPrice: minVal || undefined,
            maxPrice: maxVal || undefined
        });
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex gap-2">
                <div className="flex-1">
                    <label
                        htmlFor="price-filter-min"
                        className="mb-1 block text-text-tertiary text-xs"
                    >
                        {t('min')}
                    </label>
                    <input
                        id="price-filter-min"
                        type="number"
                        value={minVal}
                        onChange={(e) => setMinVal(e.target.value)}
                        placeholder="0"
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
                    />
                </div>
                <div className="flex-1">
                    <label
                        htmlFor="price-filter-max"
                        className="mb-1 block text-text-tertiary text-xs"
                    >
                        {t('max')}
                    </label>
                    <input
                        id="price-filter-max"
                        type="number"
                        value={maxVal}
                        onChange={(e) => setMaxVal(e.target.value)}
                        placeholder="999999"
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
                    />
                </div>
            </div>
            <button
                type="button"
                onClick={handleApply}
                className="w-full rounded-lg bg-primary py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
            >
                {t('apply')}
            </button>
        </div>
    );
}

/**
 * Stepper control: label + decrement / increment buttons for numeric values.
 */
function Stepper({
    label,
    value,
    onChange
}: {
    readonly label: string;
    readonly value: string;
    readonly onChange: (v: string) => void;
}) {
    const num = Number.parseInt(value, 10) || 0;
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-text">{label}</span>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onChange(num > 0 ? String(num - 1) : '')}
                    disabled={num <= 0}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:border-primary disabled:opacity-30"
                >
                    -
                </button>
                <span className="w-6 text-center font-medium text-sm text-text">{num || '-'}</span>
                <button
                    type="button"
                    onClick={() => onChange(String(num + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:border-primary"
                >
                    +
                </button>
            </div>
        </div>
    );
}

/**
 * Stepper group for guests, bedrooms, and bathrooms capacity filters.
 */
function CapacityFilterContent({
    currentFilters,
    t
}: {
    readonly currentFilters: Record<string, string>;
    readonly t: (key: string) => string;
}) {
    const [guests, setGuests] = useState(currentFilters.minGuests ?? '');
    const [bedrooms, setBedrooms] = useState(currentFilters.minBedrooms ?? '');
    const [bathrooms, setBathrooms] = useState(currentFilters.minBathrooms ?? '');

    const handleApply = () => {
        navigateWithParams({
            minGuests: guests || undefined,
            minBedrooms: bedrooms || undefined,
            minBathrooms: bathrooms || undefined
        });
    };

    return (
        <div className="flex flex-col gap-3">
            <Stepper
                label={t('guests')}
                value={guests}
                onChange={setGuests}
            />
            <Stepper
                label={t('bedrooms')}
                value={bedrooms}
                onChange={setBedrooms}
            />
            <Stepper
                label={t('bathrooms')}
                value={bathrooms}
                onChange={setBathrooms}
            />
            <button
                type="button"
                onClick={handleApply}
                className="w-full rounded-lg bg-primary py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
            >
                {t('apply')}
            </button>
        </div>
    );
}

/**
 * Star rating selection buttons (2+, 3+, 4+ stars).
 */
function RatingFilterContent({
    currentRating,
    t
}: {
    readonly currentRating?: string;
    readonly t: (key: string) => string;
}) {
    const options = [
        { value: '4', label: `4+ ${t('stars')}` },
        { value: '3', label: `3+ ${t('stars')}` },
        { value: '2', label: `2+ ${t('stars')}` }
    ] as const;

    return (
        <div className="flex flex-col gap-2">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                        navigateWithParams({
                            minRating: currentRating === opt.value ? undefined : opt.value
                        })
                    }
                    className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        currentRating === opt.value
                            ? 'bg-primary/10 font-medium text-primary'
                            : 'text-text hover:bg-surface-alt'
                    }`}
                >
                    {'★'.repeat(Number(opt.value))}
                    {'☆'.repeat(5 - Number(opt.value))} {opt.label}
                </button>
            ))}
        </div>
    );
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * FilterChipsBar - Horizontal bar of filter chips for the accommodation listing.
 *
 * Renders toggle chips (on/off) for boolean amenity filters and dropdown chips
 * for multi-value filters. Every interaction navigates via URL query params,
 * triggering a full server-side re-render with the updated filter state.
 *
 * @param props - FilterChipsBarProps
 */
export function FilterChipsBar({
    currentFilters,
    locale,
    accommodationTypes
}: FilterChipsBarProps) {
    const { t } = useTranslation({
        locale: locale as SupportedLocale,
        namespace: 'accommodations'
    });
    const ct = (key: string) => t(`chips.${key}`);

    const hasTypeFilter = Boolean(currentFilters.type);
    const hasPriceFilter = Boolean(currentFilters.minPrice || currentFilters.maxPrice);
    const hasCapacityFilter = Boolean(
        currentFilters.minGuests || currentFilters.minBedrooms || currentFilters.minBathrooms
    );
    const hasRatingFilter = Boolean(currentFilters.minRating);

    return (
        <div className="flex flex-wrap gap-2 pb-2">
            {/* Boolean toggle chips */}
            <ToggleChip
                label={ct('wifi')}
                paramKey="hasWifi"
                currentFilters={currentFilters}
            />
            <ToggleChip
                label={ct('pool')}
                paramKey="hasPool"
                currentFilters={currentFilters}
            />
            <ToggleChip
                label={ct('pets')}
                paramKey="allowsPets"
                currentFilters={currentFilters}
            />
            <ToggleChip
                label={ct('parking')}
                paramKey="hasParking"
                currentFilters={currentFilters}
            />

            {/* Visual divider — hidden on mobile to avoid extra height when wrapping */}
            <div
                className="mx-1 hidden w-px self-stretch bg-border sm:block"
                aria-hidden="true"
            />

            {/* Dropdown chips */}
            <DropdownChip
                label={ct('type')}
                isActive={hasTypeFilter}
            >
                <TypeFilterContent
                    types={accommodationTypes}
                    currentType={currentFilters.type}
                />
            </DropdownChip>

            <DropdownChip
                label={ct('price')}
                isActive={hasPriceFilter}
            >
                <PriceFilterContent
                    currentMin={currentFilters.minPrice}
                    currentMax={currentFilters.maxPrice}
                    t={ct}
                />
            </DropdownChip>

            <DropdownChip
                label={ct('capacity')}
                isActive={hasCapacityFilter}
            >
                <CapacityFilterContent
                    currentFilters={currentFilters}
                    t={ct}
                />
            </DropdownChip>

            <DropdownChip
                label={ct('rating')}
                isActive={hasRatingFilter}
            >
                <RatingFilterContent
                    currentRating={currentFilters.minRating}
                    t={ct}
                />
            </DropdownChip>
        </div>
    );
}
