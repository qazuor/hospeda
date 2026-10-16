import { formatDate } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui-wrapped/Card';
import { useUserTrialSummaries } from '@/features/users/hooks/useUserTrialSummaries';
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';

/** Shows per-vertical accumulated trial days to admins with inspection access. */
export function UserTrialSummaryCard({ userId }: { readonly userId: string }) {
    const { t, tPlural, locale } = useTranslations();
    const canInspect = useUserPermissions().includes(PermissionEnum.BILLING_SUBSCRIPTION_INSPECT);
    const rows = useUserTrialSummaries({ userId, enabled: canInspect });

    if (!canInspect) return null;

    return (
        <Card data-testid="user-trial-summary">
            <CardHeader divider>
                <CardTitle>{t('admin-pages.access.users.trialSummary.title')}</CardTitle>
                <CardDescription>
                    {t('admin-pages.access.users.trialSummary.description')}
                </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
                {rows.map(({ vertical, data, isLoading, isError }) => {
                    const key = `admin-pages.access.users.trialSummary`;
                    return (
                        <section
                            key={vertical}
                            data-testid={`user-trial-summary-${vertical}`}
                            className="space-y-2 py-4 first:pt-0 last:pb-0"
                        >
                            <h3 className="font-medium">{t(`${key}.vertical.${vertical}`)}</h3>
                            {isLoading ? (
                                <div
                                    aria-hidden="true"
                                    className="h-12 animate-pulse rounded-md bg-muted"
                                />
                            ) : isError || !data ? (
                                <p
                                    role="status"
                                    className="text-destructive text-sm"
                                >
                                    {t(`${key}.error`)}
                                </p>
                            ) : data.summary.status === 'NONE' ? (
                                <p className="text-sm">{t(`${key}.none`)}</p>
                            ) : data.summary.startedAt === null || data.summary.endsAt === null ? (
                                <p className="text-sm">{t(`${key}.consumedWithoutClock`)}</p>
                            ) : (
                                <div className="space-y-1 text-sm">
                                    <p>
                                        {t(`${key}.status.${data.summary.status}`)} ·{' '}
                                        {data.ceilingDays === null
                                            ? tPlural(`${key}.total`, data.summary.totalDays, {
                                                  count: data.summary.totalDays
                                              })
                                            : tPlural(`${key}.totalWithCeiling`, data.ceilingDays, {
                                                  total: data.summary.totalDays,
                                                  count: data.ceilingDays
                                              })}
                                    </p>
                                    {data.ceilingDays !== null &&
                                    data.summary.totalDays >= data.ceilingDays ? (
                                        <p
                                            role="status"
                                            className="text-destructive"
                                        >
                                            {t(`${key}.ceilingReached`)}
                                        </p>
                                    ) : null}
                                    <p>
                                        {(
                                            [
                                                ['base', data.summary.origins.base],
                                                ['promo', data.summary.origins.promo],
                                                ['support', data.summary.origins.support]
                                            ] as const
                                        )
                                            .filter(([, count]) => count > 0)
                                            .map(([origin, count]) =>
                                                tPlural(`${key}.origins.${origin}`, Number(count), {
                                                    count: Number(count)
                                                })
                                            )
                                            .join(', ')}
                                    </p>
                                    <p>
                                        {t(`${key}.dates`, {
                                            start: formatDate({
                                                date: data.summary.startedAt,
                                                locale
                                            }),
                                            end: formatDate({ date: data.summary.endsAt, locale })
                                        })}
                                    </p>
                                </div>
                            )}
                        </section>
                    );
                })}
            </CardContent>
        </Card>
    );
}
