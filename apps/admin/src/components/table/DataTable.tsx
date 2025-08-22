import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import {
    type ColumnDef,
    type SortingState,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable
} from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import {
    BadgeCell,
    BooleanCell,
    CompoundCell,
    DateCell,
    EntityCell,
    GalleryCell,
    ImageCell,
    LinkCell,
    ListCell,
    NumberCell,
    PriceCell,
    StringCell,
    TimeAgoCell,
    WidgetCell
} from './cells';

export type DataTableSort = ReadonlyArray<{
    readonly id: string;
    readonly desc: boolean;
}>;

export enum BadgeColor {
    // Semantic colors
    DEFAULT = 'default',
    PRIMARY = 'primary',
    SECONDARY = 'secondary',
    SUCCESS = 'success',
    WARNING = 'warning',
    ERROR = 'error',

    // Specific colors
    BLUE = 'blue',
    RED = 'red',
    GREEN = 'green',
    YELLOW = 'yellow',
    PURPLE = 'purple',
    PINK = 'pink',
    INDIGO = 'indigo',
    CYAN = 'cyan',
    TEAL = 'teal',
    ORANGE = 'orange',
    GRAY = 'gray',
    SLATE = 'slate'
}

export enum ColumnType {
    STRING = 'string',
    NUMBER = 'number',
    DATE = 'date',
    TIME_AGO = 'timeAgo',
    BOOLEAN = 'boolean',
    BADGE = 'badge',
    LINK = 'link',
    ENTITY = 'entity',
    LIST = 'list',
    WIDGET = 'widget',
    PRICE = 'price',
    COMPOUND = 'compound',
    IMAGE = 'image',
    GALLERY = 'gallery'
}

export enum EntityType {
    ACCOMMODATION = 'accommodation',
    DESTINATION = 'destination',
    EVENT = 'event',
    EVENT_LOCATION = 'event-location',
    EVENT_ORGANIZER = 'event-organizer',
    POST = 'post',
    USER = 'user',
    SPONSOR = 'sponsor',
    ATTRACTION = 'attraction',
    FEATURE = 'feature',
    AMENITY = 'amenity'
}

export type EntityOption = {
    readonly entityType: EntityType;
    readonly color?: BadgeColor;
};

export enum CompoundLayout {
    HORIZONTAL = 'horizontal',
    VERTICAL = 'vertical'
}

export enum ListOrientation {
    ROW = 'row',
    COLUMN = 'column'
}

export type CompoundColumnConfig = {
    readonly id: string;
    readonly accessorKey: string;
    readonly columnType?: ColumnType;
    readonly badgeOptions?: readonly BadgeOption[];
    readonly entityOptions?: EntityOption;
};

export type CompoundOption = {
    readonly columns: readonly CompoundColumnConfig[];
    readonly layout: CompoundLayout;
    readonly separator?: string;
};

export type WidgetRenderer<TData> = (row: TData) => ReactNode;

export type BadgeOption = {
    readonly value: string;
    readonly label: string;
    readonly color: BadgeColor;
};

export type LinkHandler<TData> = (row: TData) => void;

export type DataTableColumn<TData> = {
    readonly id: string;
    readonly header: ReactNode;
    readonly accessorKey?: keyof TData & string;
    readonly cell?: (ctx: { readonly row: TData }) => ReactNode;
    readonly enableSorting?: boolean;
    readonly enableHiding?: boolean;
    readonly startVisibleOnTable?: boolean; // Controls initial visibility in table view (default: true)
    readonly startVisibleOnGrid?: boolean; // Controls initial visibility in grid view (default: true)
    readonly columnType?: ColumnType;
    readonly badgeOptions?: readonly BadgeOption[];
    readonly linkHandler?: LinkHandler<TData>;
    readonly entityOptions?: EntityOption;
    readonly listSeparator?: string;
    readonly listOrientation?: ListOrientation;
    readonly widgetRenderer?: WidgetRenderer<TData>;
    readonly compoundOptions?: CompoundOption;
};

export type DataTableProps<TData> = {
    readonly columns: ReadonlyArray<DataTableColumn<TData>>;
    readonly data: ReadonlyArray<TData>;
    readonly total: number;
    readonly rowId: (row: TData) => string;
    readonly loading?: boolean;

    readonly page: number;
    readonly pageSize: number;
    readonly onPageChange: (page: number) => void;
    readonly onPageSizeChange: (pageSize: number) => void;

    readonly sort: DataTableSort;
    readonly onSortChange: (sort: DataTableSort) => void;

    readonly columnVisibility: Record<string, boolean>;
    readonly onColumnVisibilityChange: (visibility: Record<string, boolean>) => void;
};

/**
 * DataTable is a thin wrapper over TanStack Table providing a stable public API.
 * Migrate the internals freely without affecting consumers.
 */
/**
 * Renders a table cell based on the column type configuration.
 * Exported for use in other components like GridCard.
 */
export function renderCellByType<TData>(
    column: DataTableColumn<TData>,
    value: unknown,
    row: TData
): ReactNode {
    // If custom cell renderer is provided, use it
    if (column.cell) {
        return column.cell({ row });
    }

    // Render based on column type
    switch (column.columnType) {
        case ColumnType.STRING:
            return <StringCell value={value} />;
        case ColumnType.NUMBER:
            return <NumberCell value={value} />;
        case ColumnType.BOOLEAN:
            return <BooleanCell value={value} />;
        case ColumnType.BADGE:
            return (
                <BadgeCell
                    value={value}
                    options={column.badgeOptions}
                />
            );
        case ColumnType.LINK:
            return (
                <LinkCell
                    value={value}
                    row={row}
                    linkHandler={column.linkHandler}
                />
            );
        case ColumnType.DATE:
            return <DateCell value={value} />;
        case ColumnType.TIME_AGO:
            return <TimeAgoCell value={value} />;
        case ColumnType.ENTITY:
            return (
                <EntityCell
                    value={value}
                    row={row}
                    linkHandler={column.linkHandler}
                    entityOptions={column.entityOptions}
                />
            );
        case ColumnType.LIST:
            return (
                <ListCell
                    value={value}
                    separator={column.listSeparator}
                    orientation={column.listOrientation}
                />
            );
        case ColumnType.WIDGET:
            return (
                <WidgetCell
                    row={row}
                    widgetRenderer={column.widgetRenderer}
                />
            );
        case ColumnType.PRICE:
            return <PriceCell value={value} />;
        case ColumnType.COMPOUND:
            return (
                <CompoundCell
                    row={row}
                    compoundOptions={column.compoundOptions}
                />
            );
        case ColumnType.IMAGE:
            return <ImageCell value={value} />;
        case ColumnType.GALLERY:
            return <GalleryCell value={value} />;
        default:
            // Fallback to string rendering
            return <StringCell value={value} />;
    }
}

export const DataTable = <TData,>({
    columns,
    data,
    total,
    rowId,
    loading = false,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    sort,
    onSortChange,
    columnVisibility,
    onColumnVisibilityChange
}: DataTableProps<TData>) => {
    const { t } = useTranslations();

    const internalColumns: ColumnDef<TData>[] = useMemo(
        () =>
            columns.map((col) => ({
                id: col.id,
                accessorKey: col.accessorKey,
                header: () => col.header,
                cell: (info) => renderCellByType(col, info.getValue(), info.row.original),
                enableSorting: col.enableSorting ?? true,
                enableHiding: col.enableHiding ?? true
            })),
        [columns]
    );

    const sortingState: SortingState = useMemo(
        () =>
            sort.map((s) => ({
                id: s.id,
                desc: s.desc
            })),
        [sort]
    );

    const handleSortingChange = useCallback(
        (updater: SortingState | ((old: SortingState) => SortingState)) => {
            const next = typeof updater === 'function' ? updater(sortingState) : updater;
            onSortChange(next.map((s) => ({ id: s.id, desc: s.desc })));
        },
        [sortingState, onSortChange]
    );

    const handleColumnVisibilityChange = useCallback(
        (
            updater:
                | Record<string, boolean>
                | ((old: Record<string, boolean>) => Record<string, boolean>)
        ) => {
            const next = typeof updater === 'function' ? updater(columnVisibility) : updater;
            onColumnVisibilityChange(next as Record<string, boolean>);
        },
        [columnVisibility, onColumnVisibilityChange]
    );

    const memoizedData = useMemo(() => data as TData[], [data]);

    const table = useReactTable<TData>({
        data: memoizedData,
        columns: internalColumns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onSortingChange: handleSortingChange,
        state: {
            sorting: sortingState,
            columnVisibility
        },
        onColumnVisibilityChange: handleColumnVisibilityChange
    });

    const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

    return (
        <div className="space-y-3">
            <div className="overflow-x-auto rounded-md border">
                <table className="w-full table-auto text-left text-sm">
                    <thead className="bg-muted text-muted-foreground">
                        {table.getHeaderGroups().map((hg) => (
                            <tr key={hg.id}>
                                {hg.headers.map((header) => {
                                    const canSort = header.column.getCanSort();
                                    const sorting = header.column.getIsSorted();
                                    return (
                                        <th
                                            key={header.id}
                                            scope="col"
                                            className="select-none px-3 py-2 font-medium"
                                        >
                                            {canSort ? (
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        'inline-flex items-center gap-1 underline-offset-4 hover:underline'
                                                    )}
                                                    onClick={header.column.getToggleSortingHandler()}
                                                    aria-label={t('ui.accessibility.sortColumn')}
                                                >
                                                    {flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                                    <span className="text-xs">
                                                        {sorting === 'asc'
                                                            ? '▲'
                                                            : sorting === 'desc'
                                                              ? '▼'
                                                              : ''}
                                                    </span>
                                                </button>
                                            ) : (
                                                flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )
                                            )}
                                        </th>
                                    );
                                })}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td
                                    className="px-3 py-4"
                                    colSpan={columns.length}
                                >
                                    {t('ui.loading.text')}
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td
                                    className="px-3 py-6"
                                    colSpan={columns.length}
                                >
                                    {t('ui.errors.noRecordsFound')}
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <tr
                                    key={rowId(row.original)}
                                    className="border-t"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td
                                            key={cell.id}
                                            className="px-3 py-2"
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-sm">
                    {t('ui.table.pageInfo', { page, pageCount })}
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                        <span>{t('ui.table.rows')}:</span>
                        <select
                            className="rounded border px-2 py-1"
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            aria-label={t('ui.accessibility.rowsPerPage')}
                        >
                            {[10, 20, 30, 50].map((n) => (
                                <option
                                    key={n}
                                    value={n}
                                >
                                    {n}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="rounded border px-2 py-1 disabled:opacity-50"
                            onClick={() => onPageChange(Math.max(1, page - 1))}
                            disabled={page <= 1}
                        >
                            {t('ui.table.prev')}
                        </button>
                        <button
                            type="button"
                            className="rounded border px-2 py-1 disabled:opacity-50"
                            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
                            disabled={page >= pageCount}
                        >
                            {t('ui.table.next')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
