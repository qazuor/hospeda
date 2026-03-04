import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { OwnerPromotion } from './types';

interface CreateOwnerPromotionsColumnsOptions {
    onEdit: (promotion: OwnerPromotion) => void;
    onDelete: (promotion: OwnerPromotion) => void;
    onToggleActive: (promotion: OwnerPromotion) => void;
    /** Translation function from useTranslations hook */
    t: (key: string) => string;
}

/**
 * Create columns for owner promotions table
 */
export function createOwnerPromotionsColumns({
    onEdit,
    onDelete,
    onToggleActive,
    t
}: CreateOwnerPromotionsColumnsOptions): DataTableColumn<OwnerPromotion>[] {
    return [
        {
            id: 'title',
            header: t('admin-billing.ownerPromotions.columns.title'),
            accessorKey: 'title',
            enableSorting: true,
            columnType: ColumnType.STRING
        },
        {
            id: 'ownerId',
            header: t('admin-billing.ownerPromotions.columns.owner'),
            accessorKey: 'ownerId',
            enableSorting: false,
            columnType: ColumnType.STRING
        },
        {
            id: 'accommodationId',
            header: t('admin-billing.ownerPromotions.columns.accommodation'),
            accessorKey: 'accommodationId',
            enableSorting: false,
            columnType: ColumnType.STRING
        },
        {
            id: 'discountType',
            header: t('admin-billing.ownerPromotions.columns.type'),
            accessorKey: 'discountType',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'PERCENTAGE',
                    label: t('admin-billing.ownerPromotions.discountTypeLabels.percentage'),
                    color: BadgeColor.BLUE
                },
                {
                    value: 'FIXED_AMOUNT',
                    label: t('admin-billing.ownerPromotions.discountTypeLabels.fixedAmount'),
                    color: BadgeColor.GREEN
                },
                {
                    value: 'FREE_NIGHT',
                    label: t('admin-billing.ownerPromotions.discountTypeLabels.freeNight'),
                    color: BadgeColor.PURPLE
                },
                {
                    value: 'SPECIAL_PRICE',
                    label: t('admin-billing.ownerPromotions.discountTypeLabels.specialPrice'),
                    color: BadgeColor.ORANGE
                }
            ]
        },
        {
            id: 'discountValue',
            header: t('admin-billing.ownerPromotions.columns.value'),
            accessorKey: 'discountValue',
            enableSorting: true,
            columnType: ColumnType.NUMBER
        },
        {
            id: 'status',
            header: t('admin-billing.ownerPromotions.columns.status'),
            accessorKey: 'isActive',
            enableSorting: true,
            cell: ({ row }) => (
                <Badge variant={row.isActive ? 'success' : 'secondary'}>
                    {row.isActive
                        ? t('admin-billing.ownerPromotions.statusActiveLabel')
                        : t('admin-billing.ownerPromotions.statusInactiveLabel')}
                </Badge>
            )
        },
        {
            id: 'validFrom',
            header: t('admin-billing.ownerPromotions.columns.validFrom'),
            accessorKey: 'validFrom',
            enableSorting: true,
            columnType: ColumnType.DATE
        },
        {
            id: 'validUntil',
            header: t('admin-billing.ownerPromotions.columns.validUntil'),
            accessorKey: 'validUntil',
            enableSorting: true,
            columnType: ColumnType.DATE
        },
        {
            id: 'redemptions',
            header: t('admin-billing.ownerPromotions.columns.usage'),
            enableSorting: false,
            cell: ({ row }) => (
                <span className="text-sm">
                    {row.currentRedemptions} / {row.maxRedemptions || '∞'}
                </span>
            )
        },
        {
            id: 'actions',
            header: t('admin-billing.ownerPromotions.columns.actions'),
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onToggleActive(row)}
                    >
                        {row.isActive
                            ? t('admin-billing.ownerPromotions.actionDeactivate')
                            : t('admin-billing.ownerPromotions.actionActivate')}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(row)}
                    >
                        {t('admin-billing.ownerPromotions.actionEdit')}
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(row)}
                    >
                        {t('admin-billing.ownerPromotions.actionDelete')}
                    </Button>
                </div>
            )
        }
    ];
}
