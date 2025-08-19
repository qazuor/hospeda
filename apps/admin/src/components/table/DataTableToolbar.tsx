import { cn } from '@/lib/utils';
import type { ChangeEvent } from 'react';

export type DataTableToolbarProps = {
    readonly view: 'table' | 'grid';
    readonly onViewChange: (next: 'table' | 'grid') => void;

    readonly query: string;
    readonly onQueryChange: (value: string) => void;

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
    columnVisibility,
    onColumnVisibilityChange,
    availableColumns
}: DataTableToolbarProps) => {
    const handleCheckbox = (id: string) => (e: ChangeEvent<HTMLInputElement>) => {
        onColumnVisibilityChange({ ...columnVisibility, [id]: e.target.checked });
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    aria-label="Table view"
                    className={cn(
                        'rounded-md border px-3 py-1.5 text-sm',
                        view === 'table' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/40'
                    )}
                    onClick={() => onViewChange('table')}
                >
                    Table
                </button>
                <button
                    type="button"
                    aria-label="Grid view"
                    className={cn(
                        'rounded-md border px-3 py-1.5 text-sm',
                        view === 'grid' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/40'
                    )}
                    onClick={() => onViewChange('grid')}
                >
                    Grid
                </button>
            </div>

            <div className="flex items-center gap-3">
                <input
                    type="search"
                    placeholder="Search..."
                    className="h-9 rounded-md border px-3 text-sm"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    aria-label="Search"
                />

                <div className="relative">
                    <details>
                        <summary className="cursor-pointer select-none rounded-md border px-3 py-1.5 text-sm hover:bg-accent/40">
                            Columns
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
