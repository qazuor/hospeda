/**
 * PlanUsageSection — Section 2 of Mi facturación (SPEC-156 T-036).
 *
 * Renders the current user's plan usage as a stack of UsageProgressBar
 * primitives (T-035). V1 surfaces a single bar — accommodations published
 * vs the plan limit — because that's the only metric the protected
 * /usage endpoint returns today. Additional bars are easy to layer in:
 * append new entries to the `bars` array returned by the hook adapter,
 * or wrap the endpoint with additional fields when the API grows.
 *
 * Backed by `useMyUsage()` which hits `GET /api/v1/protected/billing/usage`
 * and returns `null` when the user has no active subscription.
 */

import { UsageProgressBar } from '@/components/billing/UsageProgressBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMyUsage } from '@/hooks/use-my-billing';
import { useTranslations } from '@/hooks/use-translations';

export function PlanUsageSection() {
    const { t } = useTranslations();
    const query = useMyUsage();

    const usage = query.data;
    const unlimited = usage !== null && usage?.accommodationsLimit === null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{t('admin-pages.billing.usage.title')}</CardTitle>
                <p className="text-muted-foreground text-sm">
                    {t('admin-pages.billing.usage.subtitle')}
                </p>
            </CardHeader>
            <CardContent>
                {query.isLoading && (
                    <div
                        className="h-12 animate-pulse rounded-lg bg-muted"
                        data-testid="usage-loading"
                    />
                )}

                {query.isError && (
                    <p className="text-destructive text-sm">
                        {t('admin-pages.billing.usage.errorLoading')}
                    </p>
                )}

                {usage === null && !query.isLoading && !query.isError && (
                    <p
                        className="text-muted-foreground text-sm"
                        data-testid="usage-empty"
                    >
                        {t('admin-pages.billing.usage.noActive')}
                    </p>
                )}

                {usage && (
                    <div
                        className="space-y-4"
                        data-testid="usage-bars"
                    >
                        <UsageProgressBar
                            label={t('admin-pages.billing.usage.accommodations')}
                            used={usage.accommodationsUsed}
                            limit={usage.accommodationsLimit}
                            unitOfLimitLabel={
                                unlimited
                                    ? t('admin-pages.billing.usage.unlimited')
                                    : t('admin-pages.billing.usage.unitOfLimit', {
                                          used: usage.accommodationsUsed,
                                          limit: usage.accommodationsLimit ?? 0
                                      })
                            }
                            unlimitedLabel={t('admin-pages.billing.usage.unlimited')}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
