import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { OwnerPromotionDiscountTypeEnum } from '@repo/schemas';
import type { OwnerPromotion } from '../schemas/owner-promotions.schemas';

/**
 * Format discount value based on type
 */
const formatDiscountValue = (promotion: OwnerPromotion): string => {
    switch (promotion.discountType) {
        case OwnerPromotionDiscountTypeEnum.PERCENTAGE:
            return `${promotion.discountValue}%`;
        case OwnerPromotionDiscountTypeEnum.FIXED:
            return new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS'
            }).format(promotion.discountValue);
        case OwnerPromotionDiscountTypeEnum.FREE_NIGHT:
            return `${promotion.discountValue} ${promotion.discountValue === 1 ? 'noche gratis' : 'noches gratis'}`;
        default:
            return String(promotion.discountValue);
    }
};

/**
 * Creates column configuration for owner promotions list
 */
export const createOwnerPromotionsColumns = (): readonly ColumnConfig<OwnerPromotion>[] =>
    [
        {
            id: 'title',
            header: 'Título',
            accessorKey: 'title',
            enableSorting: true,
            columnType: ColumnType.ENTITY,
            entityOptions: { entityType: EntityType.SPONSOR },
            linkHandler: (row) => ({ to: `/billing/owner-promotions/${row.id}` }),
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'owner',
            header: 'Propietario',
            accessorKey: 'ownerId',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'accommodation',
            header: 'Alojamiento',
            accessorKey: 'accommodationId',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: true,
            startVisibleOnGrid: false
        },
        {
            id: 'discountType',
            header: 'Tipo de Descuento',
            accessorKey: 'discountType',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
                    label: 'Porcentaje',
                    color: BadgeColor.BLUE
                },
                {
                    value: OwnerPromotionDiscountTypeEnum.FIXED,
                    label: 'Monto Fijo',
                    color: BadgeColor.GREEN
                },
                {
                    value: OwnerPromotionDiscountTypeEnum.FREE_NIGHT,
                    label: 'Noche Gratis',
                    color: BadgeColor.PURPLE
                }
            ],
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'discountValue',
            header: 'Valor',
            accessorKey: 'discountValue',
            enableSorting: true,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) => formatDiscountValue(row),
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'validFrom',
            header: 'Válido Desde',
            accessorKey: 'validFrom',
            enableSorting: true,
            columnType: ColumnType.DATE,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'validUntil',
            header: 'Válido Hasta',
            accessorKey: 'validUntil',
            enableSorting: true,
            columnType: ColumnType.DATE,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'redemptions',
            header: 'Canjes',
            accessorKey: 'currentRedemptions',
            enableSorting: true,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) => {
                if (row.maxRedemptions) {
                    return `${row.currentRedemptions} / ${row.maxRedemptions}`;
                }
                return String(row.currentRedemptions);
            },
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'status',
            header: 'Estado',
            accessorKey: 'isActive',
            enableSorting: true,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) => {
                if (!row.isActive) {
                    return 'Inactivo';
                }

                if (row.validUntil) {
                    const now = new Date();
                    const validUntil = new Date(row.validUntil);
                    if (validUntil < now) {
                        return 'Expirado';
                    }
                }

                return 'Activo';
            },
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'createdAt',
            header: 'Creado',
            accessorKey: 'createdAt',
            enableSorting: true,
            columnType: ColumnType.TIME_AGO,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        }
    ] as const;
