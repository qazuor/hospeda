import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import { CloseIcon, LoaderIcon, SearchIcon } from '@repo/icons';
import type { ChangeEvent } from 'react';
import { useCallback } from 'react';

export type DataTableToolbarProps = {
    readonly view: 'table' | 'grid';
    readonly onViewChange: (next: 'table' | 'grid') => void;

    readonly query: string;
    readonly onQueryChange: (value: string) => void;
    readonly isSearching?: boolean;
    readonly onClearSearch?: () => void;
    readonly searchMinChars?: number;

    readonly columnVisibility: Record<string, boolean>;
    readonly onColumnVisibilityChange: (visibility: Record<string, boolean>) => void;
    readonly availableColumns: ReadonlyArray<{
        readonly id: string;
        readonly label: string;
    }>;
};

export const DataTableToolbar = ({
    view,
    onViewChange,
    query,
    onQueryChange,
    isSearching = false,
    onClearSearch,
    searchMinChars = 3,
    columnVisibility,
    onColumnVisibilityChange,
    availableColumns
}: DataTableToolbarProps) => {
    const handleCheckbox = useCallback(
        (id: string) => (e: ChangeEvent<HTMLInputElement>) => {
            onColumnVisibilityChange({ ...columnVisibility, [id]: e.target.checked });
        },
        [columnVisibility, onColumnVisibilityChange]
    );

    const { t } = useTranslations();
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    aria-label={t('ui.accessibility.tableView')}
                    className={cn(
                        'rounded-md border px-3 py-1.5 text-sm',
                        view === 'table' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/40'
                    )}
                    onClick={() => onViewChange('table')}
                >
                    {t('ui.table.tableView')}
                </button>
                <button
                    type="button"
                    aria-label={t('ui.accessibility.gridView')}
                    className={cn(
                        'rounded-md border px-3 py-1.5 text-sm',
                        view === 'grid' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/40'
                    )}
                    onClick={() => onViewChange('grid')}
                >
                    {t('ui.table.gridView')}
                </button>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative">
                    <SearchIcon
                        size="xs"
                        className="-translate-y-1/2 absolute top-1/2 left-3 text-muted-foreground"
                    />
                    <input
                        type="search"
                        placeholder={t('ui.table.searchPlaceholder', { minChars: searchMinChars })}
                        className="h-9 rounded-md border pr-8 pl-8 text-sm"
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

                <div className="relative">
                    <details>
                        <summary className="cursor-pointer select-none rounded-md border px-3 py-1.5 text-sm hover:bg-accent/40">
                            {t('ui.table.columns')}
                        </summary>
                        <div className="absolute right-0 z-10 mt-1 w-56 rounded-md border bg-background p-2 shadow-md">
                            <div className="space-y-1 text-sm">
                                {availableColumns.map((c) => (
                                    <label
                                        key={c.id}
                                        className="flex items-center justify-between gap-3"
                                    >
                                        <span>{c.label}</span>
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4"
                                            checked={columnVisibility[c.id] ?? true}
                                            onChange={handleCheckbox(c.id)}
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    );
};
