import { formatCurrency, type TranslationKey } from '@repo/i18n';
import type { PlanMigrationPreview, PlanMigrationPreviewRow } from '@repo/schemas';
import { useTranslations } from '@/hooks/use-translations';

/** Displays every affected and excluded customer before action 17 confirmation. */
export function PlanMigrationPreviewTable({ preview }: { readonly preview: PlanMigrationPreview }) {
    const { t } = useTranslations();
    const tr = (key: string, values?: Record<string, string | number>) =>
        t(`admin-pages.planMigration.${key}` as TranslationKey, values);
    const amount = ({
        cents,
        currency
    }: {
        readonly cents: number | null;
        readonly currency: string;
    }) =>
        cents === null
            ? tr('notAvailable')
            : formatCurrency({ value: cents / 100, locale: 'es-AR', currency });
    const date = (row: PlanMigrationPreviewRow) =>
        row.outcome === 'EXCLUDED'
            ? tr(`excluded.${row.excludedReason}`)
            : row.outcome === 'PARA_RESOLVER'
              ? tr('toResolve')
              : row.waits
                ? tr('waits')
                : (row.applicationDate ?? tr('toResolve'));
    return (
        <section className="space-y-3">
            <p>{tr('notice', { days: preview.noticeDays, version: preview.deadlineVersion })}</p>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-sm">
                    <thead>
                        <tr>
                            {[
                                'customer',
                                'direction',
                                'currentAmount',
                                'newAmount',
                                'promotion',
                                'date'
                            ].map((key) => (
                                <th
                                    key={key}
                                    className="border-b p-2 text-left"
                                >
                                    {tr(`columns.${key}`)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {preview.rows.map((row) => (
                            <tr
                                key={row.subscriptionId}
                                data-testid={`plan-migration-row-${row.subscriptionId}`}
                                className="border-b"
                            >
                                <td className="p-2">
                                    {row.customerName ?? row.customerEmail}
                                    <br />
                                    {row.customerName ? row.customerEmail : null}
                                </td>
                                <td
                                    className="p-2"
                                    data-testid="plan-migration-row-direction"
                                >
                                    {row.direction
                                        ? tr(`direction.${row.direction}`)
                                        : tr('notAvailable')}
                                </td>
                                <td
                                    className="p-2"
                                    data-testid="plan-migration-row-current-amount"
                                >
                                    {amount({ cents: row.currentAmount, currency: row.currency })}
                                </td>
                                <td
                                    className="p-2"
                                    data-testid="plan-migration-row-new-amount"
                                >
                                    {amount({ cents: row.newAmount, currency: row.currency })}
                                </td>
                                <td className="p-2">
                                    {row.losesPromo ? tr('losesPromo') : tr('notAvailable')}
                                </td>
                                <td
                                    className="p-2"
                                    data-testid="plan-migration-row-date"
                                >
                                    {date(row)}
                                    {row.outcome === 'EXCLUDED' ? (
                                        <span data-testid="plan-migration-row-excluded">
                                            {' '}
                                            {tr('excludedBadge')}
                                        </span>
                                    ) : null}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
