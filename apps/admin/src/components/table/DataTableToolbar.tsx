import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import { GridIcon, ListIcon } from '@repo/icons';
import type { ChangeEvent } from 'react';
import { useCallback } from 'react';

export type DataTableToolbarProps = {
    readonly view: 'table' | 'grid';
    readonly onViewChange: (next: 'table' | 'grid') => void;

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
            <div className="inline-flex overflow-hidden rounded-md border">
                <button
                    type="button"
                    aria-label={t('ui.accessibility.tableView')}
                    aria-pressed={view === 'table'}
                    className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm',
                        view === 'table'
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-accent/40'
                    )}
                    onClick={() => onViewChange('table')}
                >
                    <ListIcon
                        weight={view === 'table' ? 'fill' : 'regular'}
                        className="h-4 w-4"
                    />
                    {t('ui.table.tableView')}
                </button>
                <button
                    type="button"
                    aria-label={t('ui.accessibility.gridView')}
                    aria-pressed={view === 'grid'}
                    className={cn(
                        'inline-flex items-center gap-1.5 border-l px-3 py-1.5 text-sm',
                        view === 'grid'
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-accent/40'
                    )}
                    onClick={() => onViewChange('grid')}
                >
                    <GridIcon
                        weight={view === 'grid' ? 'fill' : 'regular'}
                        className="h-4 w-4"
                    />
                    {t('ui.table.gridView')}
                </button>
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
    );
};
