import type { TranslationKey } from '@repo/i18n';
import { useTranslations } from '@/hooks/use-translations';
import { useRetiredPlanVersions } from '../hooks/useRetiredPlanVersions';
import { planVersionLabel } from '../utils/plan-version-label';

/** Lists every retired plan version with the live subscriptions still anchored to it. */
export function RetiredPlanVersions() {
    const { t } = useTranslations();
    const tr = (key: string) => t(`admin-pages.planMigration.${key}` as TranslationKey);
    const retired = useRetiredPlanVersions();
    return (
        <section
            className="space-y-3"
            data-testid="retired-plan-versions"
        >
            <h2 className="font-semibold text-lg">{tr('retiredVersions.title')}</h2>
            {retired.isLoading ? <p role="status">{tr('loading')}</p> : null}
            {retired.isError ? <p role="alert">{tr('errors.generic')}</p> : null}
            {retired.data?.items.length === 0 ? <p>{tr('retiredVersions.empty')}</p> : null}
            {retired.data?.items.length ? (
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="p-2 text-left">
                                    {tr('retiredVersions.columns.name')}
                                </th>
                                <th className="p-2 text-left">
                                    {tr('retiredVersions.columns.vertical')}
                                </th>
                                <th className="p-2 text-left">
                                    {tr('retiredVersions.columns.liveSubscriptions')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {retired.data.items.map((item) => (
                                <tr
                                    key={item.id}
                                    data-testid={`retired-plan-version-${item.id}`}
                                    className="border-t"
                                >
                                    <td className="p-2">
                                        {planVersionLabel({
                                            t,
                                            name: item.name,
                                            versionNumber: item.versionNumber
                                        })}
                                    </td>
                                    <td className="p-2">{item.vertical}</td>
                                    <td className="p-2">{item.liveSubscriptionCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </section>
    );
}
