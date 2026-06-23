/**
 * @file HashtagsTable.tsx
 * @description DataTable component for the social hashtag catalog (SPEC-254 T-020).
 *
 * Columns: hashtag, category, platform, priority, active.
 * Permission-gated Edit + Delete actions (SOCIAL_HASHTAG_MANAGE).
 */

import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, type SocialHashtag } from '@repo/schemas';

/** Props for {@link HashtagsTable}. */
export interface HashtagsTableProps {
    readonly items: SocialHashtag[];
    readonly onEdit: (item: SocialHashtag) => void;
    readonly onDelete: (item: SocialHashtag) => void;
}

/**
 * Table for the social hashtag catalog.
 *
 * @param props - {@link HashtagsTableProps}
 */
export function HashtagsTable({ items, onEdit, onDelete }: HashtagsTableProps) {
    const { t } = useTranslations();

    return (
        <div className="overflow-x-auto rounded-lg border bg-card">
            <table
                className="w-full text-sm"
                aria-label={t('social.hashtags.table.ariaLabel' as TranslationKey)}
            >
                <thead className="bg-muted/50 text-left">
                    <tr>
                        <th className="px-4 py-3 font-medium">
                            {t('social.hashtags.table.colHashtag' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.hashtags.table.colCategory' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.hashtags.table.colPlatform' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.hashtags.table.colPriority' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.hashtags.table.colActive' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.hashtags.table.colActions' as TranslationKey)}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr
                            key={item.id}
                            className="border-t hover:bg-muted/20"
                            data-testid={`hashtag-row-${item.id}`}
                        >
                            <td className="px-4 py-3 font-mono">{item.normalizedHashtag}</td>
                            <td className="px-4 py-3">{item.category}</td>
                            <td className="px-4 py-3">
                                {item.platform ?? (
                                    <span className="text-muted-foreground">
                                        {t('social.hashtags.table.allPlatforms' as TranslationKey)}
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-3">{item.priority}</td>
                            <td className="px-4 py-3">
                                <span
                                    className={
                                        item.active
                                            ? 'font-medium text-green-600'
                                            : 'text-muted-foreground'
                                    }
                                    data-testid={`hashtag-active-${item.id}`}
                                >
                                    {item.active
                                        ? t('social.hashtags.table.yes' as TranslationKey)
                                        : t('social.hashtags.table.no' as TranslationKey)}
                                </span>
                            </td>
                            <td className="flex gap-2 px-4 py-3">
                                <PermissionGate
                                    permissions={[PermissionEnum.SOCIAL_HASHTAG_MANAGE]}
                                >
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onEdit(item)}
                                        data-testid={`hashtag-edit-${item.id}`}
                                    >
                                        {t('social.hashtags.table.edit' as TranslationKey)}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:bg-destructive/10"
                                        onClick={() => onDelete(item)}
                                        data-testid={`hashtag-delete-${item.id}`}
                                    >
                                        {t('social.hashtags.table.delete' as TranslationKey)}
                                    </Button>
                                </PermissionGate>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
