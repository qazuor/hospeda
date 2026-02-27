/**
 * Filter panel sub-component for DestinationFilters.
 *
 * Renders the search form, destination type dropdown, cascading parent
 * destination dropdown, and clear-filters button.
 * All state and handlers are received as props from the parent orchestrator.
 */
import { SearchIcon } from '@repo/icons';
import type { DestinationItem } from './DestinationCard.client';

// ─── Constants ───────────────────────────────────────────────────────────────

/** All valid destination type values in hierarchical order. */
export const DESTINATION_TYPES = [
    'COUNTRY',
    'REGION',
    'PROVINCE',
    'DEPARTMENT',
    'CITY',
    'TOWN',
    'NEIGHBORHOOD'
] as const;

/** Union of all destination type string literals. */
export type DestinationType = (typeof DESTINATION_TYPES)[number];

// ─── Types ───────────────────────────────────────────────────────────────────

/** Props for the DestinationFilterPanel component. */
export interface DestinationFilterPanelProps {
    /** Current text search query value. */
    readonly query: string;
    /** Setter for the text query state. */
    readonly onQueryChange: (value: string) => void;
    /** Currently selected destination type. */
    readonly selectedType: string;
    /** Handler called when destination type selection changes. */
    readonly onTypeChange: (value: string) => void;
    /** Currently selected parent destination id. */
    readonly selectedParentId: string;
    /** Handler called when parent destination selection changes. */
    readonly onParentChange: (value: string) => void;
    /** Whether there are any active filters applied. */
    readonly hasActiveFilters: boolean;
    /** Handler for the form submit (search) action. */
    readonly onSearch: (e: React.FormEvent) => void;
    /** Handler to clear all active filters. */
    readonly onClearFilters: () => void;
    /** Whether the parent options dropdown should be visible. */
    readonly showParentFilter: boolean;
    /** Available options for the parent destination dropdown. */
    readonly parentOptions: readonly DestinationItem[];
    /** Whether parent options are currently being fetched. */
    readonly isLoadingParents: boolean;
    /** Whether fetching parent options resulted in an error. */
    readonly parentError: boolean;
    /** Ref forwarded to the search text input for imperative focus. */
    readonly searchInputRef: React.RefObject<HTMLInputElement | null>;
    /** Translation function from the destination namespace. */
    readonly t: (key: string, fallback?: string, params?: Record<string, unknown>) => string;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Renders the search + filter controls panel for destination filtering.
 *
 * Includes:
 * - Text search input with submit button
 * - Destination type select dropdown
 * - Cascading parent destination select (shown when a non-root type is selected)
 * - Clear filters button (shown when any filter is active)
 *
 * @param props - {@link DestinationFilterPanelProps}
 */
export function DestinationFilterPanel({
    query,
    onQueryChange,
    selectedType,
    onTypeChange,
    selectedParentId,
    onParentChange,
    hasActiveFilters,
    onSearch,
    onClearFilters,
    showParentFilter,
    parentOptions,
    isLoadingParents,
    parentError,
    searchInputRef,
    t
}: DestinationFilterPanelProps) {
    return (
        <div className="mx-auto max-w-4xl rounded-xl border border-border bg-surface p-4 shadow-md">
            {/* Search Form */}
            <form
                onSubmit={onSearch}
                className="flex gap-2"
            >
                <label
                    htmlFor="destination-search"
                    className="sr-only"
                >
                    {t('search.placeholder')}
                </label>
                <div className="relative flex-1">
                    <div className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3">
                        <SearchIcon
                            size={18}
                            className="text-text-tertiary"
                            aria-hidden="true"
                        />
                    </div>
                    <input
                        ref={searchInputRef}
                        id="destination-search"
                        type="text"
                        name="q"
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value)}
                        placeholder={t('search.placeholder')}
                        className="w-full rounded-lg border border-border bg-bg py-2.5 pr-3 pl-10 text-text-primary placeholder-text-tertiary"
                    />
                </div>
                <button
                    type="submit"
                    className="flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-white transition-colors hover:bg-primary-dark"
                    aria-label={t('search.button')}
                >
                    <SearchIcon
                        size={20}
                        aria-hidden="true"
                    />
                </button>
            </form>

            {/* Filter Controls */}
            <div className="mt-4 flex flex-wrap items-end gap-4">
                {/* Type Filter */}
                <div className="min-w-[180px] flex-1">
                    <label
                        htmlFor="destination-type-filter"
                        className="mb-1 block font-medium text-sm text-text-secondary"
                    >
                        {t('search.typeLabel')}
                    </label>
                    <select
                        id="destination-type-filter"
                        value={selectedType}
                        onChange={(e) => onTypeChange(e.target.value)}
                        className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text-primary"
                    >
                        <option value="">{t('search.allTypes')}</option>
                        {DESTINATION_TYPES.map((type) => (
                            <option
                                key={type}
                                value={type}
                            >
                                {t(`types.${type}`)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Parent Filter (conditional) */}
                {showParentFilter && (
                    <div className="min-w-[180px] flex-1">
                        <label
                            htmlFor="destination-parent-filter"
                            className="mb-1 block font-medium text-sm text-text-secondary"
                        >
                            {t('search.parentLabel')}
                        </label>
                        <select
                            id="destination-parent-filter"
                            value={selectedParentId}
                            onChange={(e) => onParentChange(e.target.value)}
                            disabled={isLoadingParents || parentError}
                            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">
                                {isLoadingParents
                                    ? t('search.loadingParents')
                                    : parentError
                                      ? t('search.noParentsAvailable')
                                      : t('search.allParents')}
                            </option>
                            {parentOptions.map((parent) => (
                                <option
                                    key={parent.id}
                                    value={parent.id}
                                >
                                    {parent.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={onClearFilters}
                        className="rounded-lg border border-border bg-bg px-4 py-2.5 font-medium text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
                    >
                        {t('search.clearFilters')}
                    </button>
                )}
            </div>
        </div>
    );
}
