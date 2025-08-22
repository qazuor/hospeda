import type { DataTableColumn } from '@/components/table/DataTable';
import { renderCellByType } from '@/components/table/DataTable';
import type { ReactNode } from 'react';

type GridCardProps<TData> = {
    readonly item: TData;
    readonly columns: ReadonlyArray<DataTableColumn<TData>>;
    readonly visibleColumns: ReadonlyArray<string>;
    readonly maxFields?: number;
};

/**
 * GridCard component that renders data in an improved card format using the same
 * cell components as the DataTable, with better visual hierarchy and organization.
 */
export const GridCard = <TData,>({
    item,
    columns,
    visibleColumns,
    maxFields = 8
}: GridCardProps<TData>): ReactNode => {
    // Filter columns to only show visible ones
    const displayColumns = columns.filter((col) => visibleColumns.includes(col.id));

    // Limit the number of fields shown in the card
    const fieldsToShow = displayColumns.slice(0, maxFields);

    // Find the primary field (usually 'name' or first entity column)
    const primaryColumn =
        fieldsToShow.find((col) => col.id === 'name' || col.columnType === 'entity') ||
        fieldsToShow[0];

    // Get remaining fields (excluding primary)
    const secondaryColumns = fieldsToShow.filter((col) => col.id !== primaryColumn?.id);

    if (!primaryColumn) {
        return (
            <article className="rounded-lg border p-4">
                <div className="text-muted-foreground text-sm">No displayable fields</div>
            </article>
        );
    }

    // Organize fields by type for better layout
    const mediaColumns = secondaryColumns.filter(
        (col) => col.columnType === 'image' || col.columnType === 'gallery'
    );
    const statsColumns = secondaryColumns.filter(
        (col) =>
            col.columnType === 'number' &&
            (col.id.includes('count') || col.id.includes('rating') || col.id.includes('reviews'))
    );
    const locationColumns = secondaryColumns.filter(
        (col) => col.id === 'city' || col.id === 'country'
    );
    const listColumns = secondaryColumns.filter((col) => col.columnType === 'list');
    const badgeColumns = secondaryColumns.filter((col) => col.columnType === 'badge');
    const otherColumns = secondaryColumns.filter(
        (col) =>
            !mediaColumns.includes(col) &&
            !statsColumns.includes(col) &&
            !locationColumns.includes(col) &&
            !listColumns.includes(col) &&
            !badgeColumns.includes(col)
    );

    return (
        <article className="group relative overflow-hidden rounded-lg border bg-card shadow-sm transition-all hover:shadow-md">
            {/* Header with primary field and badges */}
            <div className="border-b bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold text-lg leading-tight">
                            {renderCellByType(
                                primaryColumn,
                                getFieldValue(item, primaryColumn.accessorKey),
                                item
                            )}
                        </h3>
                        {/* Location info right under the title */}
                        {locationColumns.length > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-muted-foreground text-sm">
                                <svg
                                    className="h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <title>Location</title>
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                                {locationColumns.map((col, index) => {
                                    const value = getFieldValue(item, col.accessorKey);
                                    if (!value) return null;
                                    return (
                                        <span key={col.id}>
                                            {index > 0 && ', '}
                                            {String(value)}
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Status badges */}
                    {badgeColumns.length > 0 && (
                        <div className="flex flex-col gap-1">
                            {badgeColumns.slice(0, 2).map((column) => {
                                const value = getFieldValue(item, column.accessorKey);
                                if (!value) return null;
                                return (
                                    <div
                                        key={column.id}
                                        className="text-xs"
                                    >
                                        {renderCellByType(column, value, item)}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Content area */}
            <div className="space-y-4 p-4">
                {/* Media section */}
                {mediaColumns.length > 0 && (
                    <div className="space-y-3">
                        {mediaColumns.map((column) => {
                            const value = getFieldValue(item, column.accessorKey);
                            if (!value) return null;
                            return (
                                <div
                                    key={column.id}
                                    className="space-y-2"
                                >
                                    <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                                        {String(column.header)}
                                    </div>
                                    <div className="flex justify-center">
                                        <div className="overflow-hidden rounded-md">
                                            {renderCellByType(column, value, item)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Stats section */}
                {statsColumns.length > 0 && (
                    <div className="rounded-lg border bg-muted/10 p-4">
                        <div className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                            Statistics
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            {statsColumns.map((column) => {
                                const value = getFieldValue(item, column.accessorKey);
                                if (value === null || value === undefined) return null;
                                return (
                                    <div
                                        key={column.id}
                                        className="text-center"
                                    >
                                        <div className="font-bold text-primary text-xl">
                                            {renderCellByType(column, value, item)}
                                        </div>
                                        <div className="text-muted-foreground text-xs">
                                            {getStatLabel(column.id)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Lists section (attractions, etc.) */}
                {listColumns.length > 0 && (
                    <div className="space-y-3">
                        {listColumns.map((column) => {
                            const value = getFieldValue(item, column.accessorKey);
                            if (!value || (Array.isArray(value) && value.length === 0)) return null;
                            return (
                                <div
                                    key={column.id}
                                    className="rounded-lg border bg-muted/5 p-3"
                                >
                                    <div className="mb-2 flex items-center gap-2">
                                        <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                                            {String(column.header)}
                                        </div>
                                        {Array.isArray(value) && (
                                            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                                                {value.length}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm">
                                        {renderCellByType(column, value, item)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Other fields */}
                {otherColumns.length > 0 && (
                    <div className="space-y-2 border-t pt-3">
                        {otherColumns.slice(0, 3).map((column) => {
                            const value = getFieldValue(item, column.accessorKey);
                            if (value === null || value === undefined || value === '') return null;
                            return (
                                <div
                                    key={column.id}
                                    className="flex items-center justify-between text-sm"
                                >
                                    <span className="text-muted-foreground">
                                        {String(column.header)}:
                                    </span>
                                    <span className="font-medium">
                                        {renderCellByType(column, value, item)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer with more fields indicator */}
            {displayColumns.length > maxFields && (
                <div className="border-t bg-muted/20 px-4 py-2">
                    <div className="text-center text-muted-foreground text-xs">
                        +{displayColumns.length - maxFields} more fields in table view
                    </div>
                </div>
            )}
        </article>
    );
};

/**
 * Helper function to safely get nested field values from an object.
 */
function getFieldValue<TData>(item: TData, accessorKey?: string): unknown {
    if (!accessorKey || !item) {
        return undefined;
    }

    // Handle nested properties like 'media.featuredImage'
    const keys = accessorKey.split('.');
    let value: unknown = item;

    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = (value as Record<string, unknown>)[key];
        } else {
            return undefined;
        }
    }

    return value;
}

/**
 * Gets user-friendly labels for stat fields.
 */
function getStatLabel(fieldId: string): string {
    switch (fieldId) {
        case 'accommodationsCount':
            return 'Accommodations';
        case 'averageRating':
            return 'Rating';
        case 'reviewsCount':
            return 'Reviews';
        case 'attractionsCount':
            return 'Attractions';
        default:
            return fieldId.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
    }
}
