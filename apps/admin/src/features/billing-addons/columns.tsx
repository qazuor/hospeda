import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCentsToArs } from '@/lib/format-helpers';
import { defaultIntlLocale } from '@repo/i18n';
import { DeleteIcon, EditIcon, PowerIcon } from '@repo/icons';
import type { AddonDefinition } from './types';

interface AddonColumnsOptions {
    onEdit?: (addon: AddonDefinition) => void;
    onToggleActive?: (id: string, isActive: boolean) => void;
    onDelete?: (id: string) => void;
    isTogglingActive?: boolean;
    isDeleting?: boolean;
    /** Translation function from useTranslations hook */
    t: (key: string) => string;
    /** BCP 47 locale string (e.g. 'es-AR', 'en-US') */
    locale?: string;
}

/**
 * Get DataTable columns for add-ons list
 */
export function getAddonColumns(
    options: AddonColumnsOptions
): ReadonlyArray<DataTableColumn<AddonDefinition>> {
    const {
        onEdit,
        onToggleActive,
        onDelete,
        isTogglingActive,
        isDeleting,
        t,
        locale = defaultIntlLocale
    } = options;

    /**
     * Get target categories label using translations
     */
    const getCategoriesLabel = (categories: readonly string[]): string => {
        const labels: Record<string, string> = {
            owner: t('admin-billing.addons.categoryLabels.owner'),
            complex: t('admin-billing.addons.categoryLabels.complex'),
            tourist: t('admin-billing.addons.categoryLabels.tourist')
        };
        return categories.map((c) => labels[c] || c).join(', ');
    };

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
            id: 'price',
            header: t('admin-billing.addons.catalogColumns.price'),
            enableSorting: true,
            cell: ({ row }) => (
                <div>
                    <span className="font-medium">
                        {formatCentsToArs({ cents: row.priceArs, locale })}
                    </span>
                    {row.billingType === 'recurring' && (
                        <span className="text-muted-foreground text-xs">
                            {' '}
                            {t('admin-billing.addons.catalogColumns.perMonth')}
                        </span>
                    )}
                </div>
            )
        },
        {
            id: 'duration',
            header: t('admin-billing.addons.catalogColumns.duration'),
            enableSorting: false,
            cell: ({ row }) => (
                <span className="text-sm">
                    {row.durationDays
                        ? `${row.durationDays} ${t('admin-billing.addons.catalogColumns.daysUnit')}`
                        : '-'}
                </span>
            )
        },
        {
            id: 'categories',
            header: t('admin-billing.addons.catalogColumns.categories'),
            accessorKey: 'targetCategories',
            enableSorting: false,
            cell: ({ row }) => (
                <span className="text-muted-foreground text-xs">
                    {getCategoriesLabel(row.targetCategories)}
                </span>
            )
        },
        {
            id: 'status',
            header: t('admin-billing.addons.catalogColumns.status'),
            accessorKey: 'isActive',
            enableSorting: true,
            cell: ({ row }) => (
                <Badge variant={row.isActive ? 'success' : 'secondary'}>
                    {row.isActive
                        ? t('admin-billing.addons.actionActivate')
                        : t('admin-billing.addons.actionDeactivate')}
                </Badge>
            )
        },
        {
            id: 'actions',
            header: t('admin-billing.addons.catalogColumns.actions'),
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <div className="flex gap-2">
                    {onToggleActive && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onToggleActive(row.slug, !row.isActive)}
                            disabled={isTogglingActive}
                            title={
                                row.isActive
                                    ? t('admin-billing.addons.actionDeactivate')
                                    : t('admin-billing.addons.actionActivate')
                            }
                        >
                            <PowerIcon className="mr-1 h-3 w-3" />
                            {row.isActive
                                ? t('admin-billing.addons.actionDeactivate')
                                : t('admin-billing.addons.actionActivate')}
                        </Button>
                    )}
                    {onEdit && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(row)}
                            title={t('admin-billing.addons.actionEdit')}
                        >
                            <EditIcon className="mr-1 h-3 w-3" />
                            {t('admin-billing.addons.actionEdit')}
                        </Button>
                    )}
                    {onDelete && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onDelete(row.slug)}
                            disabled={isDeleting}
                            title={t('admin-billing.addons.actionDelete')}
                        >
                            <DeleteIcon className="mr-1 h-3 w-3" />
                            {t('admin-billing.addons.actionDelete')}
                        </Button>
                    )}
                </div>
            )
        }
    ];
}
