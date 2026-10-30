import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import { createElement } from 'react';
import { InlineVerifiedCell } from '@/components/entity-list/InlineVerifiedCell';
import { RatingCell, type RatingDimension } from '@/components/entity-list/RatingCell';
import { ReviewsCell } from '@/components/entity-list/ReviewsCell';
import type {
    ColumnConfig,
    ColumnTFunction,
    CreateColumnsOptions
} from '@/components/entity-list/types';
import { Views30dCell } from '@/components/entity-list/Views30dCell';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { getPublicationStatusBadgeOptions } from '@/features/listing/config/publication-status-options';
import { AccommodationTypeBadge } from '../components/AccommodationTypeBadge';
import { useAccommodationQuery } from '../hooks/useAccommodationQuery';
import type { Accommodation } from '../schemas/accommodations.schemas';

/** Accommodation rating breakdown dimensions (6), in display order. */
const ACCOMMODATION_RATING_DIMENSIONS: ReadonlyArray<RatingDimension> = [
    { key: 'cleanliness', label: 'review.form.ratingAspects.cleanliness' },
    { key: 'hospitality', label: 'review.form.ratingAspects.hospitality' },
    { key: 'services', label: 'review.form.ratingAspects.services' },
    { key: 'accuracy', label: 'review.form.ratingAspects.accuracy' },
    { key: 'communication', label: 'review.form.ratingAspects.communication' },
    { key: 'location', label: 'review.form.ratingAspects.location' }
];

/**
 * Column configuration for accommodations list.
 *
 * The optional `options.hasAnalyticsView` flag controls whether the
 * display-only "Vistas (30d)" derived column is included. When absent or
 * false, the column is omitted entirely and no API call is made.
 */
export const createAccommodationsColumns = (
    t: ColumnTFunction,
    options?: CreateColumnsOptions
): readonly ColumnConfig<Accommodation>[] => {
    /** Display-only "Vistas (30d)" column — only included with ANALYTICS_VIEW. */
    const views30dColumn: ColumnConfig<Accommodation> = {
        id: 'views30d',
        header: t('admin-entities.columns.views30d' as TranslationKey),
        accessorKey: 'id',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(Views30dCell, {
                entityId: row.id,
                entityType: 'ACCOMMODATION'
            })
    };

    const baseColumns: ReadonlyArray<ColumnConfig<Accommodation>> = [
        {
            id: 'name',
            header: t('admin-entities.columns.name'),
            accessorKey: 'name',
            enableSorting: true,
            columnType: ColumnType.ENTITY,
            entityOptions: {
                entityType: EntityType.ACCOMMODATION,
                color: BadgeColor.BLUE
            },
            linkHandler: (row) => ({
                to: '/accommodations/$id',
                params: { id: row.id }
            })
        },
        {
            id: 'type',
            header: t('admin-entities.columns.type'),
            accessorKey: 'type',
            enableSorting: true,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) => createElement(AccommodationTypeBadge, { row })
        },
        {
            id: 'destination',
            header: t('admin-entities.columns.destination'),
            accessorKey: 'cityDestination.name',
            enableSorting: false,
            columnType: ColumnType.ENTITY,
            entityOptions: {
                entityType: EntityType.DESTINATION,
                color: BadgeColor.GREEN
            },
            linkHandler: (row) =>
                row.cityDestination?.id
                    ? {
                          to: '/destinations/$id',
                          params: { id: row.cityDestination.id }
                      }
                    : undefined
        },
        {
            id: 'owner',
            header: t('admin-entities.columns.owner'),
            accessorKey: 'owner.displayName',
            enableSorting: false,
            columnType: ColumnType.ENTITY,
            entityOptions: {
                entityType: EntityType.USER,
                color: BadgeColor.PINK
            },
            linkHandler: (row) =>
                row.owner?.id
                    ? {
                          to: '/access/users/$id',
                          params: { id: row.owner.id }
                      }
                    : undefined
        },
        {
            id: 'price',
            header: t('admin-entities.columns.price'),
            accessorKey: 'price',
            enableSorting: true,
            columnType: ColumnType.PRICE,
            align: 'right'
        },
        {
            id: 'averageRating',
            header: t('admin-entities.columns.rating'),
            accessorKey: 'averageRating',
            enableSorting: true,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) =>
                createElement(RatingCell, {
                    entityId: row.id,
                    entityName: row.name,
                    averageRating: typeof row.averageRating === 'number' ? row.averageRating : 0,
                    reviewsCount: typeof row.reviewsCount === 'number' ? row.reviewsCount : 0,
                    dimensions: ACCOMMODATION_RATING_DIMENSIONS,
                    useDetailQuery: useAccommodationQuery
                })
        },
        {
            id: 'reviewsCount',
            header: t('admin-entities.columns.reviewsCount'),
            accessorKey: 'reviewsCount',
            enableSorting: true,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) =>
                createElement(ReviewsCell, {
                    entityId: row.id,
                    entityName: row.name,
                    count: typeof row.reviewsCount === 'number' ? row.reviewsCount : 0,
                    reviewsPath: '/api/v1/admin/accommodations/reviews',
                    idParamName: 'accommodationId',
                    queryKeyPrefix: 'accommodation-reviews'
                })
        },
        {
            id: 'isVerified',
            header: t('admin-entities.columns.verified'),
            accessorKey: 'isVerified',
            enableSorting: true,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) =>
                createElement(InlineVerifiedCell, {
                    entityId: row.id,
                    entityName: row.name,
                    checked: Boolean(row.isVerified),
                    permission: PermissionEnum.ACCOMMODATION_VERIFY
                })
        },
        {
            // HOS-1641: ONE read-only state column. `visibility`, `lifecycleState`
            // and `moderationState` no longer exist on a listing, and the panel
            // does not write `publicationStatus` inline: only the publication
            // transitions (PB1-PB13) do. Moderation is `POST /:id/moderate`.
            id: 'publicationStatus',
            header: t('admin-entities.columns.status'),
            accessorKey: 'publicationStatus',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: getPublicationStatusBadgeOptions({ t })
        },
        {
            id: 'createdAt',
            header: t('admin-entities.columns.createdAt'),
            accessorKey: 'createdAt',
            enableSorting: true,
            columnType: ColumnType.TIME_AGO
        }
    ];

    return options?.hasAnalyticsView ? [...baseColumns, views30dColumn] : baseColumns;
};
