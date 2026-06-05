/**
 * Column definitions for the add-on catalog (definition) DataTable.
 *
 * Uses UUID-based action callbacks mirroring the billing-plans columns.
 * This is distinct from the purchased-addons columns (purchased-columns.tsx)
 * which work with customer purchase records.
 */
import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCentsToArs } from '@/lib/format-helpers';
import { defaultIntlLocale } from '@repo/i18n';
import { DeleteIcon, EditIcon, PowerIcon, RotateCcwIcon } from '@repo/icons';
import type { ParsedAddonRecord } from './types';

interface AddonCatalogColumnsOptions {
    onEdit?: (addon: ParsedAddonRecord) => void;
    onToggleActive?: (id: string, isActive: boolean) => void;
    /** Soft-delete a non-deleted addon. */
    onDelete?: (addon: ParsedAddonRecord) => void;
    /** Restore a soft-deleted addon. */
    onRestore?: (addon: ParsedAddonRecord) => void;
    /** Permanently delete a soft-deleted addon. */
    onHardDelete?: (addon: ParsedAddonRecord) => void;
    isTogglingActive?: boolean;
    isDeleting?: boolean;
    isRestoring?: boolean;
    isHardDeleting?: boolean;
    /** Translation function from useTranslations hook */
    t: (key: string) => string;
    /** BCP 47 locale string (e.g. 'es-AR', 'en-US') */
    locale?: string;
}

/**
 * Get DataTable columns for the add-on catalog management list.
 *
 * All action callbacks use the addon `id` (UUID) as the mutation identifier.
 */
export function getAddonCatalogColumns(
    options: AddonCatalogColumnsOptions
): ReadonlyArray<DataTableColumn<ParsedAddonRecord>> {
    const {
        onEdit,
        onToggleActive,
        onDelete,
        onRestore,
        onHardDelete,
        isTogglingActive,
        isDeleting,
        isRestoring,
        isHardDeleting,
        t,
        locale = defaultIntlLocale
    } = options;

    return [
        {
            id: 'name',
            header: t('admin-billing.addons.catalogColumns.name'),
            accessorKey: 'name',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-muted-foreground text-xs">{row.description}</div>
                </div>
            )
        },
        {
            id: 'slug',
            header: t('admin-billing.addons.catalogColumns.slug'),
            accessorKey: 'slug',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <code className="rounded bg-muted px-1 py-0.5 text-xs">{row.slug}</code>
            )
        },
        {
            id: 'billingType',
            header: t('admin-billing.addons.catalogColumns.billingType'),
            accessorKey: 'billingType',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'one_time',
                    label: t('admin-billing.addons.billingTypeLabels.oneTime'),
                    color: BadgeColor.BLUE
                },
                {
                    value: 'recurring',
                    label: t('admin-billing.addons.billingTypeLabels.recurring'),
                    color: BadgeColor.PURPLE
                }
            ]
        },
        {
            id: 'priceArs',
            header: t('admin-billing.addons.catalogColumns.price'),
            accessorKey: 'priceArs',
            enableSorting: true,
            columnType: ColumnType.NUMBER,
            cell: ({ row }) => (
                <span className="font-mono text-sm">
                    {formatCentsToArs({ cents: row.priceArs, locale })}
                </span>
            )
        },
        {
            id: 'targetCategories',
            header: t('admin-billing.addons.catalogColumns.categories'),
            accessorKey: 'targetCategories',
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {row.targetCategories.map((cat) => (
                        <Badge
                            key={cat}
                            variant="outline"
                            className="text-xs"
                        >
                            {t(`admin-billing.addons.categoryLabels.${cat}`)}
                        </Badge>
                    ))}
                </div>
            )
        },
        {
            id: 'isActive',
            header: t('admin-billing.addons.catalogColumns.status'),
            accessorKey: 'isActive',
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <Badge variant={row.isActive ? 'default' : 'secondary'}>
                    {row.isActive
                        ? t('admin-billing.addons.statusActive')
                        : t('admin-billing.addons.statusInactive')}
                </Badge>
            )
        },
        {
            id: 'isDeleted',
            header: t('admin-billing.addons.catalogColumns.deleted'),
            accessorKey: 'isDeleted',
            columnType: ColumnType.STRING,
            cell: ({ row }) =>
                row.isDeleted ? (
                    <Badge variant="destructive">{t('admin-billing.addons.statusDeleted')}</Badge>
                ) : null
        },
        {
            id: 'actions',
            header: t('admin-billing.addons.catalogColumns.actions'),
            accessorKey: 'id',
            columnType: ColumnType.STRING,
            cell: ({ row }) => {
                const isDeleted = row.isDeleted;

                if (isDeleted) {
                    return (
                        <div className="flex items-center gap-1">
                            {onRestore && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={isRestoring}
                                    onClick={() => onRestore(row)}
                                    title={t('admin-billing.addons.actionRestore')}
                                >
                                    <RotateCcwIcon className="h-4 w-4 text-blue-500" />
                                </Button>
                            )}
                            {onHardDelete && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={isHardDeleting}
                                    onClick={() => onHardDelete(row)}
                                    title={t('admin-billing.addons.actionHardDelete')}
                                >
                                    <DeleteIcon className="h-4 w-4 text-destructive" />
                                </Button>
                            )}
                        </div>
                    );
                }

                return (
                    <div className="flex items-center gap-1">
                        {onEdit && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEdit(row)}
                                title={t('admin-billing.addons.actionEdit')}
                            >
                                <EditIcon className="h-4 w-4" />
                            </Button>
                        )}
                        {onToggleActive && (
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={isTogglingActive}
                                onClick={() => onToggleActive(row.id, !row.isActive)}
                                title={
                                    row.isActive
                                        ? t('admin-billing.addons.actionDeactivate')
                                        : t('admin-billing.addons.actionActivate')
                                }
                            >
                                <PowerIcon
                                    className={`h-4 w-4 ${row.isActive ? 'text-success' : 'text-muted-foreground'}`}
                                />
                            </Button>
                        )}
                        {onDelete && (
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={isDeleting}
                                onClick={() => onDelete(row)}
                                title={t('admin-billing.addons.actionDelete')}
                            >
                                <DeleteIcon className="h-4 w-4 text-destructive" />
                            </Button>
                        )}
                    </div>
                );
            }
        }
    ];
}
