import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor } from '@/components/table/DataTable';
import type { TranslationKey } from '@repo/i18n';
import type { ContentModerationTerm } from '@repo/schemas';

/**
 * Column definitions for the moderation terms data table.
 * Returns ColumnConfig[] (not TanStack ColumnDef[]) to satisfy EntityConfig.createColumns.
 */
export function createModerationTermColumns(
    t: (key: TranslationKey) => string
): ColumnConfig<ContentModerationTerm>[] {
    return [
        {
            id: 'term',
            accessorKey: 'term',
            header: t('content-moderation.terms.columns.term'),
            enableSorting: true
        },
        {
            id: 'kind',
            accessorKey: 'kind',
            header: t('content-moderation.terms.columns.kind'),
            enableSorting: true,
            columnType: 'badge' as never,
            badgeOptions: [
                {
                    value: 'word',
                    label: t('content-moderation.terms.kinds.word'),
                    color: BadgeColor.BLUE
                },
                {
                    value: 'domain',
                    label: t('content-moderation.terms.kinds.domain'),
                    color: BadgeColor.PURPLE
                }
            ]
        },
        {
            id: 'category',
            accessorKey: 'category',
            header: t('content-moderation.terms.columns.category'),
            enableSorting: true,
            columnType: 'badge' as never,
            badgeOptions: [
                {
                    value: 'hate',
                    label: t('content-moderation.categories.hate'),
                    color: BadgeColor.RED
                },
                {
                    value: 'sexual',
                    label: t('content-moderation.categories.sexual'),
                    color: BadgeColor.PINK
                },
                {
                    value: 'violence',
                    label: t('content-moderation.categories.violence'),
                    color: BadgeColor.RED
                },
                {
                    value: 'harassment',
                    label: t('content-moderation.categories.harassment'),
                    color: BadgeColor.ORANGE
                },
                {
                    value: 'self_harm',
                    label: t('content-moderation.categories.self_harm'),
                    color: BadgeColor.YELLOW
                },
                {
                    value: 'spam',
                    label: t('content-moderation.categories.spam'),
                    color: BadgeColor.GRAY
                },
                {
                    value: 'other',
                    label: t('content-moderation.categories.other'),
                    color: BadgeColor.SLATE
                }
            ]
        },
        {
            id: 'severity',
            accessorKey: 'severity',
            header: t('content-moderation.terms.columns.severity'),
            enableSorting: true
        },
        {
            id: 'enabled',
            accessorKey: 'enabled',
            header: t('content-moderation.terms.columns.enabled'),
            enableSorting: true,
            columnType: 'badge' as never,
            badgeOptions: [
                { value: 'true', label: '✓', color: BadgeColor.GREEN },
                { value: 'false', label: '✗', color: BadgeColor.RED }
            ]
        },
        {
            id: 'createdAt',
            accessorKey: 'createdAt',
            header: t('content-moderation.terms.columns.createdAt'),
            enableSorting: true
        }
    ];
}
