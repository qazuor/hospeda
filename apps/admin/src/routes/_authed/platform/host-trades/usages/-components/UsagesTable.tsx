/**
 * @file UsagesTable.tsx
 * @description The benefit-usage audit table (HOS-376 T-056).
 *
 * A native `<table>` with Tailwind, following `CommentsTable.tsx` rather than
 * TanStack Table: the page owns pagination and filtering server-side, so the
 * table has no client-side model to drive.
 *
 * Whether a row may offer to suspend is decided by
 * {@link resolveSuspendAvailability} — a pure module — and not inline here. The
 * rules are absences, and an absent button proves nothing about which rule
 * produced it.
 */

import type { HostTradeBenefitUsageAdmin } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { resolveSuspendAvailability } from '@/features/host-trades/lib/usage-suspension-rules';
import { useTranslations } from '@/hooks/use-translations';

/** Props for {@link UsagesTable}. */
export interface UsagesTableProps {
    readonly items: readonly HostTradeBenefitUsageAdmin[];
    /** Providers currently known to be suspended. May be incomplete. */
    readonly suspendedProviderIds: ReadonlySet<string>;
    /** Opens the suspend dialog for a provider the row named. */
    readonly onSuspend: (input: { hostTradeId: string; providerName: string }) => void;
    /** Whether a suspension decision is in flight. */
    readonly isDeciding: boolean;
}

const CELL = 'px-3 py-2 align-top text-sm';
const HEAD = 'px-3 py-2 text-left font-medium text-muted-foreground text-xs uppercase';

/** Colour per usage state — CONFIRMED counts, REJECTED is the abuse signal. */
const STATUS_CLASS: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-900',
    CONFIRMED: 'bg-emerald-100 text-emerald-900',
    REJECTED: 'bg-red-100 text-red-900',
    EXPIRED: 'bg-muted text-muted-foreground'
};

/** Renders a date as the admin's locale short date, or an em dash. */
function formatDate(value: Date | string | null | undefined): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

/**
 * The usage audit table.
 *
 * @param props - {@link UsagesTableProps}
 */
export function UsagesTable({
    items,
    suspendedProviderIds,
    onSuspend,
    isDeciding
}: UsagesTableProps) {
    const { t } = useTranslations();

    return (
        <div className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse">
                <thead className="border-b bg-muted/40">
                    <tr>
                        <th className={HEAD}>
                            {t('admin-pages.hostTradeUsages.usages.columns.servicedAt')}
                        </th>
                        <th className={HEAD}>
                            {t('admin-pages.hostTradeUsages.usages.columns.provider')}
                        </th>
                        <th className={HEAD}>
                            {t('admin-pages.hostTradeUsages.usages.columns.host')}
                        </th>
                        <th className={HEAD}>
                            {t('admin-pages.hostTradeUsages.usages.columns.declaredBy')}
                        </th>
                        <th className={HEAD}>
                            {t('admin-pages.hostTradeUsages.usages.columns.channel')}
                        </th>
                        <th className={HEAD}>
                            {t('admin-pages.hostTradeUsages.usages.columns.status')}
                        </th>
                        <th className={HEAD}>
                            {t('admin-pages.hostTradeUsages.usages.columns.actions')}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => {
                        const availability = resolveSuspendAvailability({
                            row: {
                                hostTradeId: item.hostTradeId,
                                providerName: item.hostTrade?.name ?? null
                            },
                            suspendedProviderIds
                        });

                        return (
                            <tr
                                key={item.id}
                                className="border-b last:border-b-0"
                                data-testid={`usage-row-${item.id}`}
                            >
                                <td className={CELL}>{formatDate(item.servicedAt)}</td>
                                <td className={CELL}>
                                    {item.hostTrade ? (
                                        <Link
                                            to="/platform/host-trades/$id"
                                            params={{ id: item.hostTradeId }}
                                            className="underline underline-offset-2"
                                        >
                                            {item.hostTrade.name}
                                        </Link>
                                    ) : (
                                        <span className="text-muted-foreground italic">
                                            {t(
                                                'admin-pages.hostTradeUsages.usages.unknownProvider'
                                            )}
                                        </span>
                                    )}
                                </td>
                                <td className={CELL}>
                                    {item.host ? (
                                        item.host.displayName
                                    ) : (
                                        <span className="text-muted-foreground italic">
                                            {t('admin-pages.hostTradeUsages.usages.unknownHost')}
                                        </span>
                                    )}
                                </td>
                                <td className={CELL}>
                                    {t(
                                        `admin-pages.hostTradeUsages.usages.declaredBy.${item.declaredBy}`
                                    )}
                                </td>
                                <td className={CELL}>
                                    {t(
                                        `admin-pages.hostTradeUsages.usages.channel.${item.creationChannel}`
                                    )}
                                </td>
                                <td className={CELL}>
                                    <span
                                        className={`inline-block rounded px-2 py-0.5 font-medium text-xs ${
                                            STATUS_CLASS[item.status] ??
                                            'bg-muted text-muted-foreground'
                                        }`}
                                    >
                                        {t(`host-trades.usages.status.${item.status}`)}
                                    </span>
                                </td>
                                <td className={CELL}>
                                    {availability.allowed && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            disabled={isDeciding}
                                            data-testid={`suspend-btn-${item.id}`}
                                            onClick={() =>
                                                onSuspend({
                                                    hostTradeId: item.hostTradeId,
                                                    providerName: availability.providerName
                                                })
                                            }
                                        >
                                            {t(
                                                'admin-pages.hostTradeUsages.usages.actions.suspendProvider'
                                            )}
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
