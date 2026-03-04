import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { defaultIntlLocale, formatCurrency, pluralize } from '@repo/i18n';
import { OwnerPromotionDiscountTypeEnum } from '@repo/schemas';
import type { OwnerPromotion } from '../schemas/owner-promotions.schemas';

/**
 * Format discount value based on type
 *
 * @param promotion - Owner promotion data
 * @param locale - BCP 47 locale string (e.g. 'es-AR', 'en-US')
 * @param t - Translation function
 */
const formatDiscountValue = (
    promotion: OwnerPromotion,
    t: (key: string) => string,
    locale = defaultIntlLocale
): string => {
    switch (promotion.discountType) {
        case OwnerPromotionDiscountTypeEnum.PERCENTAGE:
            return `${promotion.discountValue}%`;
        case OwnerPromotionDiscountTypeEnum.FIXED:
            return formatCurrency({ value: promotion.discountValue, locale, currency: 'ARS' });
        case OwnerPromotionDiscountTypeEnum.FREE_NIGHT:
            return pluralize({
                t,
                key: 'admin-entities.ownerPromotions.columns.freeNight',
                count: promotion.discountValue
            });
        default:
            return String(promotion.discountValue);
    }
};

/**
 * Creates column configuration for owner promotions list
 *
 * @param locale - BCP 47 locale string (e.g. 'es-AR', 'en-US')
 * @param t - Translation function
 */
export const createOwnerPromotionsColumns = (
    locale = defaultIntlLocale,
    t: (key: string) => string = (k) => k
): readonly ColumnConfig<OwnerPromotion>[] =>
    [
        {
            id: 'title',
            header: t('admin-entities.ownerPromotions.columns.title'),
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
            header: t('admin-entities.ownerPromotions.columns.owner'),
            accessorKey: 'ownerId',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'accommodation',
            header: t('admin-entities.ownerPromotions.columns.accommodation'),
            accessorKey: 'accommodationId',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: true,
            startVisibleOnGrid: false
        },
        {
            id: 'discountType',
            header: t('admin-entities.ownerPromotions.columns.discountType'),
            accessorKey: 'discountType',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
                    label: t('admin-entities.ownerPromotions.discountTypes.percentage'),
                    color: BadgeColor.BLUE
                },
                {
                    value: OwnerPromotionDiscountTypeEnum.FIXED,
                    label: t('admin-entities.ownerPromotions.discountTypes.fixed'),
                    color: BadgeColor.GREEN
                },
                {
                    value: OwnerPromotionDiscountTypeEnum.FREE_NIGHT,
                    label: t('admin-entities.ownerPromotions.discountTypes.freeNight'),
                    color: BadgeColor.PURPLE
                }
            ],
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'discountValue',
            header: t('admin-entities.ownerPromotions.columns.discountValue'),
            accessorKey: 'discountValue',
            enableSorting: true,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) => formatDiscountValue(row, t, locale),
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'validFrom',
            header: t('admin-entities.ownerPromotions.columns.validFrom'),
            accessorKey: 'validFrom',
            enableSorting: true,
            columnType: ColumnType.DATE,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'validUntil',
            header: t('admin-entities.ownerPromotions.columns.validUntil'),
            accessorKey: 'validUntil',
            enableSorting: true,
            columnType: ColumnType.DATE,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'redemptions',
            header: t('admin-entities.ownerPromotions.columns.redemptions'),
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
            header: t('admin-entities.ownerPromotions.columns.status'),
            accessorKey: 'isActive',
            enableSorting: true,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) => {
                if (!row.isActive) {
                    return t('admin-entities.ownerPromotions.statuses.inactive');
                }

                if (row.validUntil) {
                    const now = new Date();
                    const validUntil = new Date(row.validUntil);
                    if (validUntil < now) {
                        return t('admin-entities.ownerPromotions.statuses.expired');
                    }
                }

                return t('admin-entities.ownerPromotions.statuses.active');
            },
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'createdAt',
            header: t('admin-entities.ownerPromotions.columns.createdAt'),
            accessorKey: 'createdAt',
            enableSorting: true,
            columnType: ColumnType.TIME_AGO,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        }
    ] as const;
