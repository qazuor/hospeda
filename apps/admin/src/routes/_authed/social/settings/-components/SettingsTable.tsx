/**
 * @file SettingsTable.tsx
 * @description DataTable component for social automation settings (SPEC-254 T-021).
 *
 * Columns: key, type (badge), value (masked for secrets), description.
 * Permission-gated Edit action only (SOCIAL_SETTINGS_MANAGE). No delete, no create.
 */

import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, type SocialSetting } from '@repo/schemas';

/** Badge color map for the setting type column. */
const TYPE_BADGE_CLASS: Record<SocialSetting['type'], string> = {
    string: 'bg-blue-100 text-blue-700',
    number: 'bg-purple-100 text-purple-700',
    boolean: 'bg-teal-100 text-teal-700',
    json: 'bg-orange-100 text-orange-700',
    secret: 'bg-red-100 text-red-700'
};

/** Props for {@link SettingsTable}. */
export interface SettingsTableProps {
    readonly items: SocialSetting[];
    readonly onEdit: (item: SocialSetting) => void;
}

/**
 * Table for social automation settings.
 * Secret-typed values arrive already masked as '***' from the API.
 * Edit-only — no delete or create actions available.
 *
 * @param props - {@link SettingsTableProps}
 */
export function SettingsTable({ items, onEdit }: SettingsTableProps) {
    const { t } = useTranslations();

    return (
        <div className="overflow-x-auto rounded-lg border bg-card">
            <table
                className="w-full text-sm"
                aria-label={t('social.settings.table.ariaLabel' as TranslationKey)}
            >
                <thead className="bg-muted/50 text-left">
                    <tr>
                        <th className="px-4 py-3 font-medium">
                            {t('social.settings.table.colKey' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.settings.table.colType' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.settings.table.colValue' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.settings.table.colDescription' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.settings.table.colActions' as TranslationKey)}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr
                            key={item.id}
                            className="border-t hover:bg-muted/20"
                            data-testid={`setting-row-${item.id}`}
                        >
                            <td className="px-4 py-3 font-medium font-mono text-xs">{item.key}</td>
                            <td className="px-4 py-3">
                                <span
                                    className={`inline-block rounded px-2 py-0.5 font-medium text-xs ${TYPE_BADGE_CLASS[item.type]}`}
                                    data-testid={`setting-type-badge-${item.id}`}
                                >
                                    {item.type}
                                </span>
                            </td>
                            <td
                                className="max-w-xs truncate px-4 py-3 font-mono text-xs"
                                data-testid={`setting-value-${item.id}`}
                            >
                                {item.value}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                                {item.description ?? (
                                    <span className="italic">
                                        {t('social.settings.table.noDescription' as TranslationKey)}
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-3">
                                <PermissionGate
                                    permissions={[PermissionEnum.SOCIAL_SETTINGS_MANAGE]}
                                >
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onEdit(item)}
                                        data-testid={`setting-edit-${item.id}`}
                                    >
                                        {t('social.settings.table.edit' as TranslationKey)}
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
