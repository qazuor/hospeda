import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import type { Post } from '../schemas/posts.schemas';

export const createPostsColumns = (): readonly ColumnConfig<Post>[] => [
    {
        id: 'title',
        header: 'Title',
        accessorKey: 'title',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.POST,
            color: BadgeColor.INDIGO
        },
        linkHandler: (row) => ({
            to: '/posts/$slug',
            params: { slug: row.slug }
        })
    },
    {
        id: 'category',
        header: 'Category',
        accessorKey: 'category',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            { value: 'EVENTS', label: 'Events', color: BadgeColor.BLUE },
            { value: 'CULTURE', label: 'Culture', color: BadgeColor.RED },
            { value: 'GASTRONOMY', label: 'Gastronomy', color: BadgeColor.GREEN },
            { value: 'NATURE', label: 'Nature', color: BadgeColor.YELLOW },
            { value: 'TOURISM', label: 'Tourism', color: BadgeColor.PURPLE },
            { value: 'GENERAL', label: 'General', color: BadgeColor.PINK },
            { value: 'SPORT', label: 'Sport', color: BadgeColor.INDIGO },
            { value: 'CARNIVAL', label: 'Carnival', color: BadgeColor.CYAN },
            { value: 'NIGHTLIFE', label: 'Nightlife', color: BadgeColor.TEAL },
            { value: 'HISTORY', label: 'History', color: BadgeColor.ORANGE },
            { value: 'TRADITIONS', label: 'Traditions', color: BadgeColor.GRAY },
            { value: 'WELLNESS', label: 'Wellness', color: BadgeColor.SLATE },
            { value: 'FAMILY', label: 'Family', color: BadgeColor.BLUE },
            { value: 'TIPS', label: 'Tips', color: BadgeColor.RED },
            { value: 'ART', label: 'Art', color: BadgeColor.GREEN },
            { value: 'BEACH', label: 'Beach', color: BadgeColor.YELLOW },
            { value: 'RURAL', label: 'Rural', color: BadgeColor.PURPLE },
            { value: 'FESTIVALS', label: 'Festivals', color: BadgeColor.PINK }
        ]
    },
    // Author column with computed field
    {
        id: 'author',
        header: 'Author',
        accessorKey: 'authorName',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.USER,
            color: BadgeColor.PINK
        },
        linkHandler: (row) =>
            row.author?.id
                ? {
                      to: '/users/$id',
                      params: { id: row.author.id }
                  }
                : undefined
    },
    // Related accommodation column
    {
        id: 'relatedAccommodation',
        header: 'Rel. Accommodation',
        accessorKey: 'accommodationName',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.ACCOMMODATION,
            color: BadgeColor.BLUE
        },
        linkHandler: (row) =>
            row.relatedAccommodation?.id
                ? {
                      to: '/accommodations/$id',
                      params: { id: row.relatedAccommodation.id }
                  }
                : undefined,
        startVisibleOnTable: true,
        startVisibleOnGrid: true
    },
    // Related destination column
    {
        id: 'relatedDestination',
        header: 'Rel. Destination',
        accessorKey: 'destinationName',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.DESTINATION,
            color: BadgeColor.GREEN
        },
        linkHandler: (row) =>
            row.relatedDestination?.id
                ? {
                      to: '/destinations/$id',
                      params: { id: row.relatedDestination.id }
                  }
                : undefined,
        startVisibleOnTable: true,
        startVisibleOnGrid: true
    },
    // Related event column
    {
        id: 'relatedEvent',
        header: 'Rel. Event',
        accessorKey: 'eventName',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.EVENT,
            color: BadgeColor.ORANGE
        },
        linkHandler: (row) =>
            row.relatedEvent?.id
                ? {
                      to: '/events/$id',
                      params: { id: row.relatedEvent.id }
                  }
                : undefined,
        startVisibleOnTable: true,
        startVisibleOnGrid: true
    },
    {
        id: 'sponsorship',
        header: 'Sponsorship',
        accessorKey: 'sponsorshipInfo',
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.SPONSORSHIP,
            color: BadgeColor.PURPLE
        },
        linkHandler: (row) =>
            row.sponsorship?.id
                ? {
                      to: '/sponsorships/$id',
                      params: { id: row.sponsorship.id }
                  }
                : undefined,
        startVisibleOnTable: true,
        startVisibleOnGrid: true
    },
    {
        id: 'sponsor',
        header: 'Sponsor',
        accessorKey: 'sponsorName',
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.SPONSOR,
            color: BadgeColor.ORANGE
        },
        linkHandler: (row) =>
            row.sponsorship?.sponsor?.id
                ? {
                      to: '/sponsors/$id',
                      params: { id: row.sponsorship.sponsor.id }
                  }
                : undefined,
        startVisibleOnTable: true,
        startVisibleOnGrid: true
    },
    {
        id: 'publishedAt',
        header: 'Published',
        accessorKey: 'publishedAt',
        enableSorting: true,
        columnType: ColumnType.DATE
    },
    {
        id: 'readingTimeMinutes',
        header: 'Reading Time',
        accessorKey: 'readingTimeMinutes',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'featuredImage',
        header: 'Featured Image',
        accessorKey: 'media.featuredImage',
        enableSorting: false,
        columnType: ColumnType.IMAGE,
        startVisibleOnTable: false,
        startVisibleOnGrid: true
    },
    {
        id: 'isFeatured',
        header: 'Featured',
        accessorKey: 'isFeatured',
        enableSorting: true,
        columnType: ColumnType.BOOLEAN
    },
    {
        id: 'createdAt',
        header: 'Created',
        accessorKey: 'createdAt',
        enableSorting: true,
        columnType: ColumnType.TIME_AGO
    }
];
