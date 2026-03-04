import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCentsToArs, formatShortDate } from '@/lib/format-helpers';
import { defaultIntlLocale } from '@repo/i18n';
import { DeleteIcon, EditIcon, PowerIcon } from '@repo/icons';
import type { PlanCategory, PromoCode } from './types';

/**
 * Format discount value based on type
 *
 * @param type - Discount type: 'percentage' or 'fixed'
 * @param value - Discount value
 * @param locale - BCP 47 locale string (e.g. 'es-AR', 'en-US')
 */
function formatDiscount(
    type: 'percentage' | 'fixed',
    value: number,
    locale: string = defaultIntlLocale
): string {
    if (type === 'percentage') {
        return `${value}%`;
    }
    return formatCentsToArs({ cents: value, locale });
}

/**
 * Format usage count
 */
function formatUsage(used: number, max: number | null): string {
    return max ? `${used} / ${max}` : `${used} / ∞`;
}

interface PromoCodeColumnsOptions {
    onEdit?: (promoCode: PromoCode) => void;
    onToggleActive?: (id: string, isActive: boolean) => void;
    onDelete?: (promoCode: PromoCode) => void;
    isTogglingActive?: boolean;
    isDeleting?: boolean;
    /** Translation function from useTranslations hook */
    t: (key: string) => string;
    /** BCP 47 locale string (e.g. 'es-AR', 'en-US') */
    locale?: string;
}

/**
 * Get DataTable columns for promo codes list
 */
export function getPromoCodeColumns(
    options: PromoCodeColumnsOptions
): ReadonlyArray<DataTableColumn<PromoCode>> {
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
     * Get plan label using translations
     */
    const getPlanLabel = (plan: PlanCategory): string => {
        switch (plan) {
            case 'owner':
                return t('admin-billing.promoCodes.planLabels.owner');
            case 'complex':
                return t('admin-billing.promoCodes.planLabels.complex');
            case 'tourist':
                return t('admin-billing.promoCodes.planLabels.tourist');
        }
    };

    /**
     * Format date range using translation patterns
     */
    const formatDateRange = (from: Date, until: Date | null): string => {
        const fromStr = formatShortDate({ date: from, locale });
        if (!until) {
            return t('admin-billing.promoCodes.columns.validFrom').replace('{date}', fromStr);
        }
        const untilStr = formatShortDate({ date: until, locale });
        return t('admin-billing.promoCodes.columns.validRange')
            .replace('{from}', fromStr)
            .replace('{until}', untilStr);
    };

    return [
        {
            id: 'code',
            header: t('admin-billing.promoCodes.columns.code'),
            accessorKey: 'code',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <div>
                    <code className="rounded bg-muted px-2 py-1 font-mono text-sm">{row.code}</code>
                    <div className="mt-1 text-muted-foreground text-xs">{row.description}</div>
                </div>
            )
        },
        {
            id: 'type',
            header: t('admin-billing.promoCodes.columns.type'),
            accessorKey: 'type',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'percentage',
                    label: t('admin-billing.promoCodes.typeLabels.percentage'),
                    color: BadgeColor.BLUE
                },
                {
                    value: 'fixed',
                    label: t('admin-billing.promoCodes.typeLabels.fixed'),
                    color: BadgeColor.PURPLE
                }
            ]
        },
        {
            id: 'discount',
            header: t('admin-billing.promoCodes.columns.discount'),
            accessorKey: 'discountValue',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <span className="font-semibold">
                    {formatDiscount(row.type, row.discountValue, locale)}
                </span>
            )
        },
        {
            id: 'usage',
            header: t('admin-billing.promoCodes.columns.usage'),
            accessorKey: 'usedCount',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <span className="text-muted-foreground text-sm">
                    {formatUsage(row.usedCount, row.maxUses)}
                </span>
            )
        },
        {
            id: 'validity',
            header: t('admin-billing.promoCodes.columns.validity'),
            accessorKey: 'validFrom',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <span className="text-sm">{formatDateRange(row.validFrom, row.validUntil)}</span>
            )
        },
        {
            id: 'plans',
            header: t('admin-billing.promoCodes.columns.plans'),
            accessorKey: 'applicablePlans',
            enableSorting: false,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {row.applicablePlans.length === 3 ? (
                        <Badge variant="secondary">
                            {t('admin-billing.promoCodes.columns.allPlans')}
                        </Badge>
                    ) : (
                        row.applicablePlans.map((plan) => (
                            <Badge
                                key={plan}
                                variant="outline"
                            >
                                {getPlanLabel(plan)}
                            </Badge>
                        ))
                    )}
                </div>
            )
        },
        {
            id: 'features',
            header: t('admin-billing.promoCodes.columns.features'),
            enableSorting: false,
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {row.isStackable && (
                        <Badge
                            variant="outline"
                            className="text-xs"
                        >
                            {t('admin-billing.promoCodes.columns.stackable')}
                        </Badge>
                    )}
                    {row.requiresFirstPurchase && (
                        <Badge
                            variant="outline"
                            className="text-xs"
                        >
                            {t('admin-billing.promoCodes.columns.firstPurchase')}
                        </Badge>
                    )}
                    {row.minimumAmount && (
                        <Badge
                            variant="outline"
                            className="text-xs"
                        >
                            {t('admin-billing.promoCodes.columns.minimum')}
                        </Badge>
                    )}
                </div>
            )
        },
        {
            id: 'status',
            header: t('admin-billing.promoCodes.columns.status'),
            accessorKey: 'status',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'active',
                    label: t('admin-billing.promoCodes.columns.statusActive'),
                    color: BadgeColor.GREEN
                },
                {
                    value: 'expired',
                    label: t('admin-billing.promoCodes.columns.statusExpired'),
                    color: BadgeColor.GRAY
                },
                {
                    value: 'inactive',
                    label: t('admin-billing.promoCodes.columns.statusInactive'),
                    color: BadgeColor.RED
                }
            ]
        },
        {
            id: 'actions',
            header: t('admin-billing.promoCodes.columns.actions'),
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <div className="flex gap-2">
                    {onToggleActive && row.status !== 'expired' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onToggleActive(row.id, !row.isActive)}
                            disabled={isTogglingActive}
                            title={
                                row.isActive
                                    ? t('admin-billing.promoCodes.actionDeactivate')
                                    : t('admin-billing.promoCodes.actionActivate')
                            }
                        >
                            <PowerIcon className="mr-1 h-3 w-3" />
                            {row.isActive
                                ? t('admin-billing.promoCodes.actionDeactivate')
                                : t('admin-billing.promoCodes.actionActivate')}
                        </Button>
                    )}
                    {onEdit && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(row)}
                            title={t('admin-billing.promoCodes.actionEdit')}
                        >
                            <EditIcon className="mr-1 h-3 w-3" />
                            {t('admin-billing.promoCodes.actionEdit')}
                        </Button>
                    )}
                    {onDelete && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onDelete(row)}
                            disabled={isDeleting}
                            title={t('admin-billing.promoCodes.actionDelete')}
                        >
                            <DeleteIcon className="mr-1 h-3 w-3" />
                            {t('admin-billing.promoCodes.actionDelete')}
                        </Button>
                    )}
                </div>
            )
        }
    ];
}
