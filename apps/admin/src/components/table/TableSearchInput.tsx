/**
 * @file TableSearchInput component
 *
 * The list search box (icon + input + loader/clear affordance). Extracted from
 * `DataTableToolbar` so it can live in the filter row next to the filter
 * controls instead of hanging alone in the top toolbar.
 */

import { useTranslations } from '@/hooks/use-translations';
import { CloseIcon, LoaderIcon, SearchIcon } from '@repo/icons';

export type TableSearchInputProps = {
    readonly query: string;
    readonly onQueryChange: (value: string) => void;
    readonly isSearching?: boolean;
    readonly onClearSearch?: () => void;
    readonly searchMinChars?: number;
    readonly searchPlaceholder?: string;
};

/**
 * Renders the list search input with a leading icon and a trailing
 * loader (while searching) or clear button (when there is a query).
 * Sized `h-8` to align with the filter controls in the same row.
 */
export const TableSearchInput = ({
    query,
    onQueryChange,
    isSearching = false,
    onClearSearch,
    searchMinChars = 3,
    searchPlaceholder
}: TableSearchInputProps) => {
    const { t } = useTranslations();

    return (
        <div className="relative">
            <SearchIcon
                size="xs"
                className="-translate-y-1/2 absolute top-1/2 left-3 text-muted-foreground"
            />
            <input
                type="search"
                placeholder={
                    searchPlaceholder ||
                    t('ui.table.searchPlaceholder', { minChars: searchMinChars })
                }
                className="h-8 w-56 rounded-md border pr-8 pl-8 text-sm"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                aria-label={t('ui.accessibility.search')}
            />
            <div className="-translate-y-1/2 absolute top-1/2 right-3">
                {isSearching ? (
                    <LoaderIcon
                        size="xs"
                        className="text-muted-foreground"
                        aria-label={t('common.search')}
                    />
                ) : query.length > 0 ? (
                    <button
                        type="button"
                        onClick={onClearSearch}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={t('common.clear')}
                    >
                        <CloseIcon size="xs" />
                    </button>
                ) : null}
            </div>
        </div>
    );
};
