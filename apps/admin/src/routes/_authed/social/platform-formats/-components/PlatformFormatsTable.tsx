/**
 * @file PlatformFormatsTable.tsx
 * @description DataTable component for social platform format config rows (SPEC-254 T-021).
 *
 * Columns: platform, publishFormat, mediaType, enabled, mvpEnabled, maxCaptionLength,
 * makeChannelKey.
 * Permission-gated Edit action only (SOCIAL_PLATFORM_MANAGE). No delete, no create.
 */

import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, type SocialPlatformFormat } from '@repo/schemas';

/** Props for {@link PlatformFormatsTable}. */
export interface PlatformFormatsTableProps {
    readonly items: SocialPlatformFormat[];
    readonly onEdit: (item: SocialPlatformFormat) => void;
}

/**
 * Table for social platform format configuration rows.
 * Edit-only — no delete or create actions available.
 *
 * @param props - {@link PlatformFormatsTableProps}
 */
export function PlatformFormatsTable({ items, onEdit }: PlatformFormatsTableProps) {
    const { t } = useTranslations();

    return (
        <div className="overflow-x-auto rounded-lg border bg-card">
            <table
                className="w-full text-sm"
                aria-label={t('social.platformFormats.table.ariaLabel' as TranslationKey)}
            >
                <thead className="bg-muted/50 text-left">
                    <tr>
                        <th className="px-4 py-3 font-medium">
                            {t('social.platformFormats.table.colPlatform' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.platformFormats.table.colPublishFormat' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.platformFormats.table.colMediaType' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.platformFormats.table.colEnabled' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.platformFormats.table.colMvpEnabled' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t(
                                'social.platformFormats.table.colMaxCaptionLength' as TranslationKey
                            )}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.platformFormats.table.colMakeChannelKey' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.platformFormats.table.colActions' as TranslationKey)}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr
                            key={item.id}
                            className="border-t hover:bg-muted/20"
                            data-testid={`platform-format-row-${item.id}`}
                        >
                            <td className="px-4 py-3 font-medium">{item.platform}</td>
                            <td className="px-4 py-3">{item.publishFormat}</td>
                            <td className="px-4 py-3">{item.mediaType}</td>
                            <td className="px-4 py-3">
                                <span
                                    className={
                                        item.enabled
                                            ? 'font-medium text-green-600'
                                            : 'text-muted-foreground'
                                    }
                                    data-testid={`platform-format-enabled-${item.id}`}
                                >
                                    {item.enabled
                                        ? t('social.platformFormats.table.yes' as TranslationKey)
                                        : t('social.platformFormats.table.no' as TranslationKey)}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                <span
                                    className={
                                        item.mvpEnabled
                                            ? 'font-medium text-green-600'
                                            : 'text-muted-foreground'
                                    }
                                >
                                    {item.mvpEnabled
                                        ? t('social.platformFormats.table.yes' as TranslationKey)
                                        : t('social.platformFormats.table.no' as TranslationKey)}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                {item.maxCaptionLength ?? (
                                    <span className="text-muted-foreground">
                                        {t(
                                            'social.platformFormats.table.noLimit' as TranslationKey
                                        )}
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">
                                {item.makeChannelKey ?? (
                                    <span className="text-muted-foreground">—</span>
                                )}
                            </td>
                            <td className="px-4 py-3">
                                <PermissionGate
                                    permissions={[PermissionEnum.SOCIAL_PLATFORM_MANAGE]}
                                >
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onEdit(item)}
                                        data-testid={`platform-format-edit-${item.id}`}
                                    >
                                        {t('social.platformFormats.table.edit' as TranslationKey)}
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
