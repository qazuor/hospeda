/**
 * @file BatchesTable.tsx
 * @description DataTable component for the social content batches catalog (SPEC-254 T-020).
 *
 * Columns: name, description, starts, ends, active.
 * Permission-gated Edit + Delete actions (SOCIAL_BATCH_MANAGE).
 */

import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, type SocialContentBatch } from '@repo/schemas';
import { formatCalendarDate } from '@repo/utils';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';

/** Props for {@link BatchesTable}. */
export interface BatchesTableProps {
    readonly items: SocialContentBatch[];
    readonly onEdit: (item: SocialContentBatch) => void;
    readonly onDelete: (item: SocialContentBatch) => void;
}

/**
 * Formats a batch window boundary — a calendar day, not an instant.
 *
 * `startsAt`/`endsAt` come from a bare `<input type="date">`, so they are
 * stored as UTC-midnight timestamps. Read in a browser behind UTC (Argentina,
 * UTC-3) they roll the calendar date back a day (2027-01-01 → "31 dic 2026").
 * This file pinned `timeZone: 'UTC'` by hand and was right; it now delegates so
 * the rule lives in one place instead of being rediscovered per screen — which
 * is exactly what did NOT happen on four other screens (smoke agosto 2026,
 * H-09/H-63/H-73/H-84).
 */
function formatDate(d: Date | undefined | null): string {
    return (
        formatCalendarDate({
            value: d,
            locale: 'es-AR',
            options: { day: '2-digit', month: 'short', year: 'numeric' }
        }) ?? '—'
    );
}

function truncate(text: string, max = 50): string {
    return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/**
 * Table for the social content batches catalog.
 *
 * @param props - {@link BatchesTableProps}
 */
export function BatchesTable({ items, onEdit, onDelete }: BatchesTableProps) {
    const { t } = useTranslations();

    return (
        <div className="overflow-x-auto rounded-lg border bg-card">
            <table
                className="w-full text-sm"
                aria-label={t('social.batches.table.ariaLabel' as TranslationKey)}
            >
                <thead className="bg-muted/50 text-left">
                    <tr>
                        <th className="px-4 py-3 font-medium">
                            {t('social.batches.table.colName' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.batches.table.colDesc' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.batches.table.colStartsAt' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.batches.table.colEndsAt' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.batches.table.colActive' as TranslationKey)}
                        </th>
                        <th className="px-4 py-3 font-medium">
                            {t('social.batches.table.colActions' as TranslationKey)}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr
                            key={item.id}
                            className="border-t hover:bg-muted/20"
                            data-testid={`batch-row-${item.id}`}
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
                                        ? t('social.batches.table.yes' as TranslationKey)
                                        : t('social.batches.table.no' as TranslationKey)}
                                </span>
                            </td>
                            <td className="flex gap-2 px-4 py-3">
                                <PermissionGate permissions={[PermissionEnum.SOCIAL_BATCH_MANAGE]}>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onEdit(item)}
                                        data-testid={`batch-edit-${item.id}`}
                                    >
                                        {t('social.batches.table.edit' as TranslationKey)}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:bg-destructive/10"
                                        onClick={() => onDelete(item)}
                                        data-testid={`batch-delete-${item.id}`}
                                    >
                                        {t('social.batches.table.delete' as TranslationKey)}
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
