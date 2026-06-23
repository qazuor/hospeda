/**
 * @file CampaignsTable.tsx
 * @description DataTable component for the social campaigns catalog (SPEC-254 T-020).
 *
 * Columns: name, description, starts, ends, active.
 * Permission-gated Edit + Delete actions (SOCIAL_CAMPAIGN_MANAGE).
 */

import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, type SocialCampaign } from '@repo/schemas';

/** Props for {@link CampaignsTable}. */
export interface CampaignsTableProps {
    readonly items: SocialCampaign[];
    readonly onEdit: (item: SocialCampaign) => void;
    readonly onDelete: (item: SocialCampaign) => void;
}

function formatDate(d: Date | undefined | null): string {
    if (!d) return '—';
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

function truncate(text: string, max = 50): string {
    return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/**
 * Table for the social campaigns catalog.
 *
 * @param props - {@link CampaignsTableProps}
 */
export function CampaignsTable({ items, onEdit, onDelete }: CampaignsTableProps) {
    const { t } = useTranslations();

    return (
        <div className="overflow-x-auto rounded-lg border bg-card">
            <table
                className="w-full text-sm"
                aria-label={t('social.campaigns.table.ariaLabel' as TranslationKey)}
            >
                <thead className="bg-muted/50 text-left">
                    <tr>
                        <th className="px-4 py-3 font-medium">
                            {t('social.campaigns.table.colName' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.campaigns.table.colDesc' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.campaigns.table.colStartsAt' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.campaigns.table.colEndsAt' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.campaigns.table.colActive' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.campaigns.table.colActions' as TranslationKey)}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr
                            key={item.id}
                            className="border-t hover:bg-muted/20"
                            data-testid={`campaign-row-${item.id}`}
                        >
                            <td className="px-4 py-3 font-medium">{item.name}</td>
                            <td className="max-w-xs px-4 py-3 text-muted-foreground">
                                {item.description ? truncate(item.description) : '—'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                                {formatDate(item.startsAt)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                                {formatDate(item.endsAt)}
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
                                        ? t('social.campaigns.table.yes' as TranslationKey)
                                        : t('social.campaigns.table.no' as TranslationKey)}
                                </span>
                            </td>
                            <td className="flex gap-2 px-4 py-3">
                                <PermissionGate
                                    permissions={[PermissionEnum.SOCIAL_CAMPAIGN_MANAGE]}
                                >
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onEdit(item)}
                                        data-testid={`campaign-edit-${item.id}`}
                                    >
                                        {t('social.campaigns.table.edit' as TranslationKey)}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:bg-destructive/10"
                                        onClick={() => onDelete(item)}
                                        data-testid={`campaign-delete-${item.id}`}
                                    >
                                        {t('social.campaigns.table.delete' as TranslationKey)}
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
