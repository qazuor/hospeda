/**
 * @file AudiencesTable.tsx
 * @description DataTable component for the social audiences catalog (SPEC-254 T-020).
 *
 * Columns: name, slug, description, active.
 * Permission-gated Edit + Delete actions (SOCIAL_AUDIENCE_MANAGE).
 */

import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, type SocialAudience } from '@repo/schemas';

/** Props for {@link AudiencesTable}. */
export interface AudiencesTableProps {
    readonly items: SocialAudience[];
    readonly onEdit: (item: SocialAudience) => void;
    readonly onDelete: (item: SocialAudience) => void;
}

function truncate(text: string, max = 60): string {
    return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/**
 * Table for the social audiences catalog.
 *
 * @param props - {@link AudiencesTableProps}
 */
export function AudiencesTable({ items, onEdit, onDelete }: AudiencesTableProps) {
    const { t } = useTranslations();

    return (
        <div className="overflow-x-auto rounded-lg border bg-card">
            <table
                className="w-full text-sm"
                aria-label={t('social.audiences.table.ariaLabel' as TranslationKey)}
            >
                <thead className="bg-muted/50 text-left">
                    <tr>
                        <th className="px-4 py-3 font-medium">
                            {t('social.audiences.table.colName' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.audiences.table.colSlug' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.audiences.table.colDesc' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.audiences.table.colActive' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.audiences.table.colActions' as TranslationKey)}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr
                            key={item.id}
                            className="border-t hover:bg-muted/20"
                            data-testid={`audience-row-${item.id}`}
                        >
                            <td className="px-4 py-3 font-medium">{item.name}</td>
                            <td className="px-4 py-3 font-mono text-muted-foreground">
                                {item.slug}
                            </td>
                            <td className="max-w-xs px-4 py-3 text-muted-foreground">
                                {item.description ? truncate(item.description) : '—'}
                            </td>
                            <td className="px-4 py-3">
                                <span
                                    className={
                                        item.active
                                            ? 'font-medium text-green-600'
                                            : 'text-muted-foreground'
                                    }
                                >
                                    {item.active
                                        ? t('social.audiences.table.yes' as TranslationKey)
                                        : t('social.audiences.table.no' as TranslationKey)}
                                </span>
                            </td>
                            <td className="flex gap-2 px-4 py-3">
                                <PermissionGate
                                    permissions={[PermissionEnum.SOCIAL_AUDIENCE_MANAGE]}
                                >
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onEdit(item)}
                                        data-testid={`audience-edit-${item.id}`}
                                    >
                                        {t('social.audiences.table.edit' as TranslationKey)}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:bg-destructive/10"
                                        onClick={() => onDelete(item)}
                                        data-testid={`audience-delete-${item.id}`}
                                    >
                                        {t('social.audiences.table.delete' as TranslationKey)}
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
