import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType, ListOrientation } from '@/components/table/DataTable';
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
        header: 'Type',
        accessorKey: 'category',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            { value: 'ARTICLE', label: 'Article', color: BadgeColor.BLUE },
            { value: 'GUIDE', label: 'Guide', color: BadgeColor.GREEN },
            { value: 'NEWS', label: 'News', color: BadgeColor.ORANGE },
            { value: 'REVIEW', label: 'Review', color: BadgeColor.PURPLE },
            { value: 'BLOG', label: 'Blog', color: BadgeColor.CYAN },
            { value: 'OTHER', label: 'Other', color: BadgeColor.GRAY }
        ]
    },
    // {
    //     id: 'author',
    //     header: 'Author',
    //     accessorKey: 'authorName', // This field doesn't exist in PostListItemSchema
    //     enableSorting: true,
    //     columnType: ColumnType.ENTITY,
    //     entityOptions: {
    //         entityType: EntityType.USER,
    //         color: BadgeColor.PINK
    //     },
    //     linkHandler: (row) =>
    //         row.authorId && row.authorId !== null
    //             ? {
    //                   to: '/users/$id',
    //                   params: { id: row.authorId }
    //               }
    //             : undefined
    // },
    {
        id: 'authorId',
        header: 'Author ID',
        accessorKey: 'authorId',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    // {
    //     id: 'destination',
    //     header: 'Destination',
    //     accessorKey: 'destinationName', // This field doesn't exist in PostListItemSchema
    //     enableSorting: true,
    //     columnType: ColumnType.ENTITY,
    //     entityOptions: {
    //         entityType: EntityType.DESTINATION,
    //         color: BadgeColor.GREEN
    //     },
    //     linkHandler: (row) =>
    //         row.destinationId && row.destinationId !== null
    //             ? {
    //                   to: '/destinations/$id',
    //                   params: { id: row.destinationId }
    //               }
    //             : undefined
    // },
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
        id: 'viewsCount',
        header: 'Views',
        accessorKey: 'viewsCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'likesCount',
        header: 'Likes',
        accessorKey: 'likesCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'commentsCount',
        header: 'Comments',
        accessorKey: 'commentsCount',
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
        id: 'tags',
        header: 'Tags',
        accessorKey: 'tags',
        enableSorting: false,
        columnType: ColumnType.LIST,
        listSeparator: ' • ',
        listOrientation: ListOrientation.ROW,
        startVisibleOnTable: false,
        startVisibleOnGrid: true
    },
    {
        id: 'categories',
        header: 'Categories',
        accessorKey: 'categories',
        enableSorting: false,
        columnType: ColumnType.LIST,
        listSeparator: ' • ',
        listOrientation: ListOrientation.ROW,
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
        id: 'visibility',
        header: 'Visibility',
        accessorKey: 'visibility',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            { value: 'PUBLIC', label: 'Public', color: BadgeColor.PURPLE },
            { value: 'PRIVATE', label: 'Private', color: BadgeColor.CYAN },
            { value: 'HIDDEN', label: 'Hidden', color: BadgeColor.PINK }
        ]
    },
    {
        id: 'moderationState',
        header: 'Moderation',
        accessorKey: 'moderationState',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        startVisibleOnTable: false,
        startVisibleOnGrid: false,
        badgeOptions: [
            { value: 'PENDING', label: 'Pending', color: BadgeColor.PINK },
            { value: 'APPROVED', label: 'Approved', color: BadgeColor.CYAN },
            { value: 'REJECTED', label: 'Rejected', color: BadgeColor.PURPLE },
            { value: 'UNDER_REVIEW', label: 'Under Review', color: BadgeColor.GREEN }
        ]
    },
    {
        id: 'createdAt',
        header: 'Created',
        accessorKey: 'createdAt',
        enableSorting: true,
        columnType: ColumnType.TIME_AGO
    }
];
