import type { TranslationKey } from '@repo/i18n';
import type { PlanMigrationDetailRow } from '@repo/schemas';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { usePlanMigrationDetail } from '../hooks/usePlanMigrationReads';
import { PlanMigrationCancelDialog } from './PlanMigrationCancelDialog';

const states = ['PARA_RESOLVER', 'PENDIENTE', 'APLICADA', 'FUERA', 'CANCELADA'] as const;

/** Shows scope states with unresolved customers first and server-supplied age. */
export function PlanMigrationDetail({
    id,
    onClose
}: {
    readonly id: string;
    readonly onClose: () => void;
}) {
    const { t, tPlural } = useTranslations();
    const tr = (key: string, values?: Record<string, string | number>) =>
        t(`admin-pages.planMigration.${key}` as TranslationKey, values);
    const detail = usePlanMigrationDetail({ id });
    const rowContent = (row: PlanMigrationDetailRow) => {
        const reason = row.outReason ? tr(`outReasons.${row.outReason}`) : null;
        if (row.status === 'PARA_RESOLVER')
            return (
                <tr
                    key={row.id}
                    className="border-t"
                    data-testid="plan-migration-detail-row"
                >
                    <td className="p-2">{row.subscriptionId}</td>
                    <td
                        className="p-2"
                        data-testid="plan-migration-row-age"
                    >
                        {tPlural('admin-pages.planMigration.detail.age', row.ageDays ?? 0)}
                    </td>
                </tr>
            );
        return (
            <tr
                key={row.id}
                className="border-t"
                data-testid="plan-migration-detail-row"
            >
                <td className="p-2">{row.subscriptionId}</td>
                <td className="p-2">{row.applicationDate ?? tr('notAvailable')}</td>
                <td className="p-2">{reason ?? tr('notAvailable')}</td>
            </tr>
        );
    };
    return (
        <section
            className="space-y-4"
            data-testid="plan-migration-detail"
        >
            <Button
                type="button"
                variant="outline"
                onClick={onClose}
            >
                {tr('detail.back')}
            </Button>
            {detail.isLoading ? <p role="status">{tr('detail.loading')}</p> : null}
            {detail.isError ? <p role="alert">{tr('errors.generic')}</p> : null}
            {detail.data ? (
                <>
                    <header className="space-y-2">
                        <h2 className="font-semibold text-lg">
                            {detail.data.sourcePlanName} → {detail.data.targetPlanName}
                        </h2>
                        <p>
                            {tPlural(
                                'admin-pages.planMigration.detail.notice',
                                detail.data.noticeDays
                            )}
                        </p>
                        <p>
                            {tr('detail.announced', {
                                date: detail.data.announcedAt.toISOString().slice(0, 10)
                            })}
                        </p>
                        <p>{detail.data.cancelledAt ? tr('list.cancelled') : tr('list.active')}</p>
                        <PlanMigrationCancelDialog detail={detail.data} />
                    </header>
                    {states.map((state) => {
                        const rows = detail.data.rows.filter((row) => row.status === state);
                        return (
                            <section
                                key={state}
                                data-testid={`plan-migration-rows-${state}`}
                                className={
                                    state === 'PARA_RESOLVER'
                                        ? 'rounded-md border border-warning bg-warning/10 p-3'
                                        : 'rounded-md border p-3'
                                }
                            >
                                <h3 className="font-medium">
                                    {tr(`states.${state}`)} ({detail.data.counts[state]})
                                </h3>
                                {rows.length ? (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr>
                                                <th className="p-2 text-left">
                                                    {tr('detail.subscription')}
                                                </th>
                                                <th className="p-2 text-left">
                                                    {state === 'PARA_RESOLVER'
                                                        ? tr('detail.ageHeading')
                                                        : tr('detail.applicationDate')}
                                                </th>
                                                {state === 'PARA_RESOLVER' ? null : (
                                                    <th className="p-2 text-left">
                                                        {tr('detail.outReason')}
                                                    </th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>{rows.map(rowContent)}</tbody>
                                    </table>
                                ) : (
                                    <p>{tr('detail.noRows')}</p>
                                )}
                            </section>
                        );
                    })}
                </>
            ) : null}
        </section>
    );
}
