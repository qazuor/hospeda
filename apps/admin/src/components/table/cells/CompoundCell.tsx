import type { CompoundOption } from '@/components/table/DataTable';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { BadgeCell } from './BadgeCell';
import { BooleanCell } from './BooleanCell';
import { DateCell } from './DateCell';
import { EntityCell } from './EntityCell';
import { NumberCell } from './NumberCell';
import { StringCell } from './StringCell';
import { TimeAgoCell } from './TimeAgoCell';

type CompoundCellProps<TData> = {
    readonly row: TData;
    readonly compoundOptions?: CompoundOption;
};

/**
 * CompoundCell component for rendering multiple column values in a single cell.
 * Supports horizontal and vertical layouts with customizable separators.
 * Each sub-column can have its own type and rendering logic.
 */
export const CompoundCell = <TData,>({
    row,
    compoundOptions
}: CompoundCellProps<TData>): ReactNode => {
    if (!compoundOptions || !compoundOptions.columns || compoundOptions.columns.length === 0) {
        return <span className="text-gray-400 dark:text-gray-500">No compound config</span>;
    }

    const { columns, layout, separator = layout === 'horizontal' ? ' • ' : '' } = compoundOptions;

    // Render each sub-column
    const renderedColumns = columns.map((column) => {
        const value = getNestedValue(row, column.accessorKey);
        const renderedValue = renderColumnValue(value, row, column);

        return (
            <div
                key={column.id}
                className="compound-column-item"
            >
                {renderedValue}
            </div>
        );
    });

    // Apply layout styling
    const containerClasses = cn(
        'compound-cell-container',
        layout === 'horizontal' ? 'flex items-center gap-1' : 'flex flex-col gap-1'
    );

    if (layout === 'horizontal' && separator) {
        // For horizontal layout with separator, intersperse separators between items
        const itemsWithSeparators: ReactNode[] = [];
        renderedColumns.forEach((column, index) => {
            itemsWithSeparators.push(column);
            if (index < renderedColumns.length - 1) {
                itemsWithSeparators.push(
                    <span
                        key={`h-sep-${columns[index]?.id || index}`}
                        className="text-gray-400 dark:text-gray-500"
                    >
                        {separator}
                    </span>
                );
            }
        });

        return <div className={containerClasses}>{itemsWithSeparators}</div>;
    }

    if (layout === 'vertical' && separator) {
        // For vertical layout with separator, add separator between items
        const itemsWithSeparators: ReactNode[] = [];
        renderedColumns.forEach((column, index) => {
            itemsWithSeparators.push(column);
            if (index < renderedColumns.length - 1) {
                itemsWithSeparators.push(
                    <div
                        key={`v-sep-${columns[index]?.id || index}`}
                        className="text-center text-gray-400 text-xs dark:text-gray-500"
                    >
                        {separator}
                    </div>
                );
            }
        });

        return <div className={containerClasses}>{itemsWithSeparators}</div>;
    }

    // Default layout without separators
    return <div className={containerClasses}>{renderedColumns}</div>;
};

/**
 * Gets a nested value from an object using dot notation.
 */
function getNestedValue(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== 'object') {
        return undefined;
    }

    return path.split('.').reduce((current: unknown, key: string) => {
        if (current && typeof current === 'object' && key in current) {
            return (current as Record<string, unknown>)[key];
        }
        return undefined;
    }, obj);
}

/**
 * Renders a column value based on its type.
 */
function renderColumnValue<TData>(
    value: unknown,
    row: TData,
    column: CompoundOption['columns'][0]
): ReactNode {
    switch (column.columnType) {
        case 'string':
            return <StringCell value={value} />;
        case 'number':
            return <NumberCell value={value} />;
        case 'boolean':
            return <BooleanCell value={value} />;
        case 'badge':
            return (
                <BadgeCell
                    value={value}
                    options={column.badgeOptions}
                />
            );
        case 'entity':
            return (
                <EntityCell
                    value={value}
                    row={row}
                    entityOptions={column.entityOptions}
                />
            );
        case 'date':
            return <DateCell value={value} />;
        case 'timeAgo':
            return <TimeAgoCell value={value} />;
        case 'link':
            // Note: Link functionality is limited in compound cells
            return <StringCell value={value} />;
        default:
            // Fallback to string rendering
            return <StringCell value={value} />;
    }
}
