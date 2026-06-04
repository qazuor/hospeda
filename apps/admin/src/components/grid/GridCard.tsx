import { EmptyState } from '@/components/feedback/EmptyState';
import type { DataTableColumn } from '@/components/table/DataTable';
import { renderCellByType } from '@/components/table/DataTable';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { DeleteIcon, EditIcon, EyeIcon, LocationIcon } from '@repo/icons';
import type { ReactNode } from 'react';

/**
 * Props for the polished generic GridCard component.
 */
type GridCardProps<TData> = {
    readonly item: TData;
    readonly columns: ReadonlyArray<DataTableColumn<TData>>;
    readonly visibleColumns: ReadonlyArray<string>;
    readonly maxFields?: number;
    /** Called when the user clicks the peek (view) action. */
    readonly onPeek?: (item: TData) => void;
    /** Called when the user clicks the edit action. */
    readonly onEdit?: (item: TData) => void;
    /** Called when the user clicks the delete action. */
    readonly onDelete?: (item: TData) => void;
};

/**
 * Props passed to empty-state grid containers when zero rows are present.
 * Exported so callers can render their own empty state via `gridConfig.renderCard`
 * without duplicating the design-system treatment.
 */
export type GridEmptyStateProps = {
    /** Whether a filter is active that may account for the empty result set. */
    readonly hasActiveFilters?: boolean;
};

/**
 * Renders the shared empty state for a grid view.
 * Uses the `EmptyState` component from the admin design system.
 */
export const GridEmptyState = ({ hasActiveFilters = false }: GridEmptyStateProps): ReactNode => {
    const messageKey = hasActiveFilters
        ? ('admin-entities.list.noResultsFiltered' as TranslationKey)
        : ('admin-entities.list.noResults' as TranslationKey);
    return (
        <div className="col-span-full">
            <EmptyState
                messageKey={messageKey}
                className="py-16"
            />
        </div>
    );
};

/**
 * Polished generic GridCard component.
 *
 * Renders a single entity row as a card with:
 * - Clear visual hierarchy (primary title + secondary fields)
 * - Dedicated action affordance (peek / edit / delete, keyboard-accessible)
 * - Location sub-title, badge grouping, stats panel, list items, and other fields
 * - Responsive single-column reflow on narrow viewports via the parent grid container
 *
 * All entity configs that do NOT supply `gridConfig.renderCard` receive this card.
 */
export const GridCard = <TData,>({
    item,
    columns,
    visibleColumns,
    maxFields = 8,
    onPeek,
    onEdit,
    onDelete
}: GridCardProps<TData>): ReactNode => {
    const { t } = useTranslations();

    const hasActions = Boolean(onPeek ?? onEdit ?? onDelete);

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
            <article
                className="rounded-lg border bg-card p-4"
                data-testid="grid-card"
            >
                <div className="text-muted-foreground text-sm">
                    {t('ui.grid.noDisplayableFields')}
                </div>
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
        <article
            className="group relative flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary/40 hover:shadow-md"
            data-testid="grid-card"
        >
            {/* ── Header: primary field + badges ── */}
            <div className="border-b bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold text-base text-foreground leading-snug">
                            {renderCellByType(
                                primaryColumn,
                                getFieldValue(item, primaryColumn.accessorKey),
                                item
                            )}
                        </h3>

                        {/* Location sub-title */}
                        {locationColumns.length > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-muted-foreground text-xs">
                                <LocationIcon
                                    className="h-3 w-3 shrink-0"
                                    aria-hidden="true"
                                />
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
                        <div className="flex flex-col items-end gap-1">
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

            {/* ── Content area ── */}
            <div className="flex-1 space-y-3 p-4">
                {/* Media */}
                {mediaColumns.length > 0 && (
                    <div className="space-y-2">
                        {mediaColumns.map((column) => {
                            const value = getFieldValue(item, column.accessorKey);
                            if (!value) return null;
                            return (
                                <div
                                    key={column.id}
                                    className="space-y-1"
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

                {/* Stats */}
                {statsColumns.length > 0 && (
                    <div className="rounded-md border bg-muted/10 px-3 py-2">
                        <div className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                            {t('admin-entities.grid.statistics' as TranslationKey)}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {statsColumns.map((column) => {
                                const value = getFieldValue(item, column.accessorKey);
                                if (value === null || value === undefined) return null;
                                return (
                                    <div
                                        key={column.id}
                                        className="text-center"
                                    >
                                        <div className="font-bold text-lg text-primary leading-tight">
                                            {renderCellByType(column, value, item)}
                                        </div>
                                        <div className="mt-0.5 text-muted-foreground text-xs">
                                            {getStatLabel(column.id, t)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Lists */}
                {listColumns.length > 0 && (
                    <div className="space-y-2">
                        {listColumns.map((column) => {
                            const value = getFieldValue(item, column.accessorKey);
                            if (!value || (Array.isArray(value) && value.length === 0)) return null;
                            return (
                                <div
                                    key={column.id}
                                    className="rounded-md border bg-muted/5 p-3"
                                >
                                    <div className="mb-1.5 flex items-center gap-2">
                                        <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                                            {String(column.header)}
                                        </div>
                                        {Array.isArray(value) && (
                                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary text-xs">
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
                    <div className="space-y-1.5 border-t pt-3">
                        {otherColumns.slice(0, 3).map((column) => {
                            const value = getFieldValue(item, column.accessorKey);
                            if (value === null || value === undefined || value === '') return null;
                            return (
                                <div
                                    key={column.id}
                                    className="flex items-center justify-between gap-2 text-sm"
                                >
                                    <span className="shrink-0 text-muted-foreground">
                                        {String(column.header)}:
                                    </span>
                                    <span className="truncate text-right font-medium">
                                        {renderCellByType(column, value, item)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── More-fields indicator ── */}
            {displayColumns.length > maxFields && (
                <div className="border-t bg-muted/20 px-4 py-2">
                    <div className="text-center text-muted-foreground text-xs">
                        +{displayColumns.length - maxFields}{' '}
                        {t('admin-entities.grid.moreFields' as TranslationKey)}
                    </div>
                </div>
            )}

            {/* ── Action affordance ── */}
            {hasActions && (
                <div
                    className="flex items-center justify-end gap-1 border-t bg-muted/10 px-3 py-2"
                    data-testid="grid-card-actions"
                >
                    {onPeek && (
                        <button
                            type="button"
                            aria-label={t('admin-entities.grid.actions.peek' as TranslationKey)}
                            tabIndex={0}
                            onClick={() => onPeek(item)}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        >
                            <EyeIcon
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                        </button>
                    )}
                    {onEdit && (
                        <button
                            type="button"
                            aria-label={t('admin-entities.grid.actions.edit' as TranslationKey)}
                            tabIndex={0}
                            onClick={() => onEdit(item)}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        >
                            <EditIcon
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            type="button"
                            aria-label={t('admin-entities.grid.actions.delete' as TranslationKey)}
                            tabIndex={0}
                            onClick={() => onDelete(item)}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
                        >
                            <DeleteIcon
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                        </button>
                    )}
                </div>
            )}
        </article>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely gets a nested field value from an object using dot-notation accessor.
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
 * Returns a user-friendly label for a stat field using translations.
 * Falls back to camelCase-to-Title-Case conversion.
 */
function getStatLabel(fieldId: string, t: (key: TranslationKey) => string): string {
    const key = `admin-entities.columns.${fieldId}` as TranslationKey;
    const translated = t(key);

    if (!translated.startsWith('[MISSING:')) {
        return translated;
    }

    return fieldId.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
}
