/**
 * @file FootersTable.tsx
 * @description DataTable component for the social post footer catalog (SPEC-254 T-020).
 *
 * Columns: name, platform, priority, default, active.
 * Permission-gated Edit + Delete actions (SOCIAL_FOOTER_MANAGE).
 */

import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, type SocialPostFooter } from '@repo/schemas';

/** Props for {@link FootersTable}. */
export interface FootersTableProps {
    readonly items: SocialPostFooter[];
    readonly onEdit: (item: SocialPostFooter) => void;
    readonly onDelete: (item: SocialPostFooter) => void;
}

/** Truncates a string to a max length. */
function truncate(text: string, max = 60): string {
    return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/**
 * Table for the social post footer catalog.
 *
 * @param props - {@link FootersTableProps}
 */
export function FootersTable({ items, onEdit, onDelete }: FootersTableProps) {
    const { t } = useTranslations();

    return (
        <div className="overflow-x-auto rounded-lg border bg-card">
            <table
                className="w-full text-sm"
                aria-label={t('social.footers.table.ariaLabel' as TranslationKey)}
            >
                <thead className="bg-muted/50 text-left">
                    <tr>
                        <th className="px-4 py-3 font-medium">
                            {t('social.footers.table.colName' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.footers.table.colContent' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.footers.table.colPlatform' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.footers.table.colPriority' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.footers.table.colDefault' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.footers.table.colActive' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.footers.table.colActions' as TranslationKey)}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr
                            key={item.id}
                            className="border-t hover:bg-muted/20"
                            data-testid={`footer-row-${item.id}`}
                        >
                            <td className="px-4 py-3 font-medium">{item.name}</td>
                            <td className="max-w-xs px-4 py-3 text-muted-foreground">
                                {truncate(item.content)}
                            </td>
                            <td className="px-4 py-3">
                                {item.platform ?? (
                                    <span className="text-muted-foreground">
                                        {t('social.footers.table.allPlatforms' as TranslationKey)}
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-3">{item.priority}</td>
                            <td className="px-4 py-3">
                                {item.isDefault ? (
                                    <span className="font-medium text-blue-600">
                                        {t('social.footers.table.yes' as TranslationKey)}
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground">
                                        {t('social.footers.table.no' as TranslationKey)}
                                    </span>
                                )}
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
                                        ? t('social.footers.table.yes' as TranslationKey)
                                        : t('social.footers.table.no' as TranslationKey)}
                                </span>
                            </td>
                            <td className="flex gap-2 px-4 py-3">
                                <PermissionGate permissions={[PermissionEnum.SOCIAL_FOOTER_MANAGE]}>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onEdit(item)}
                                        data-testid={`footer-edit-${item.id}`}
                                    >
                                        {t('social.footers.table.edit' as TranslationKey)}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:bg-destructive/10"
                                        onClick={() => onDelete(item)}
                                        data-testid={`footer-delete-${item.id}`}
                                    >
                                        {t('social.footers.table.delete' as TranslationKey)}
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
