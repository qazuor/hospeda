import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import { ChevronDownIcon, GridIcon, ListIcon } from '@repo/icons';
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
    const handleColumnToggle = useCallback(
        (id: string, checked: boolean) => {
            onColumnVisibilityChange({ ...columnVisibility, [id]: checked });
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

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent/40"
                    >
                        {t('ui.table.columns')}
                        <ChevronDownIcon
                            weight="regular"
                            className="h-4 w-4 opacity-60"
                        />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    className="w-56"
                >
                    <DropdownMenuLabel>{t('ui.table.columns')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {availableColumns.map((c) => (
                        <DropdownMenuCheckboxItem
                            key={c.id}
                            checked={columnVisibility[c.id] ?? true}
                            onCheckedChange={(checked) =>
                                handleColumnToggle(c.id, checked === true)
                            }
                            onSelect={(e) => e.preventDefault()}
                        >
                            {c.label}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
