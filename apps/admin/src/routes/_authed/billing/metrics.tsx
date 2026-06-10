/**
 * Billing Metrics - Usage Analytics Page
 *
 * Renders system-wide usage stats and the approaching-limits table.
 *
 * The per-customer search + usage drill-down that used to live here was
 * disabled in the billing UI audit (see docs/billing/ui-audit-2026.md):
 * `GET /admin/billing/customers/search` and
 * `GET /admin/billing/customers/:id/usage` do not exist on the backend.
 * The section is replaced by a placeholder banner; the related hooks are
 * still exported but stay disabled in `features/billing-metrics/hooks.ts`.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ApproachingLimitsTable,
    SystemStatsCards,
    useApproachingLimitsQuery,
    useSystemUsageStatsQuery
} from '@/features/billing-metrics';
import { useTranslations } from '@/hooks/use-translations';
import { requireBillingAccess } from '@/lib/billing-access';
import { LoaderIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/billing/metrics')({
    beforeLoad: ({ context }) => requireBillingAccess(context),
    component: BillingMetricsPage
});

function BillingMetricsPage() {
    const { t } = useTranslations();

    // Fetch system-wide stats
    const {
        data: systemStats,
        isLoading: isLoadingStats,
        error: statsError
    } = useSystemUsageStatsQuery();

    // Fetch approaching limits
    const {
        data: approachingLimits,
        isLoading: isLoadingLimits,
        error: limitsError
    } = useApproachingLimitsQuery(90);

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="mb-2 font-bold text-2xl">{t('admin-billing.metrics.title')}</h1>
                    <p className="text-muted-foreground">
                        {t('admin-billing.metrics.description')}
                    </p>
                </div>

                {/* System Stats Cards */}
                {isLoadingStats ? (
                    <Card>
                        <CardContent className="py-8 text-center">
                            <LoaderIcon className="mx-auto h-6 w-6 animate-spin text-primary" />
                            <p className="mt-2 text-muted-foreground text-sm">
                                {t('admin-billing.metrics.loadingStats')}
                            </p>
                        </CardContent>
                    </Card>
                ) : statsError ? (
                    <Card className="border-destructive">
                        <CardContent className="py-8 text-center">
                            <p className="text-destructive text-sm">
                                {t('admin-billing.metrics.errorStats')}
                            </p>
                            <p className="mt-1 text-muted-foreground text-xs">
                                {statsError.message}
                            </p>
                        </CardContent>
                    </Card>
                ) : systemStats && approachingLimits ? (
                    <SystemStatsCards
                        stats={systemStats}
                        approachingLimitsCount={approachingLimits.totalCustomers}
                    />
                ) : null}

                {/* Approaching Limits */}
                {isLoadingLimits ? (
                    <Card>
                        <CardContent className="py-8 text-center">
                            <LoaderIcon className="mx-auto h-6 w-6 animate-spin text-primary" />
                            <p className="mt-2 text-muted-foreground text-sm">
                                {t('admin-billing.metrics.loadingLimits')}
                            </p>
                        </CardContent>
                    </Card>
                ) : limitsError ? (
                    <Card className="border-destructive">
                        <CardContent className="py-8 text-center">
                            <p className="text-destructive text-sm">
                                {t('admin-billing.metrics.errorLimits')}
                            </p>
                            <p className="mt-1 text-muted-foreground text-xs">
                                {limitsError.message}
                            </p>
                        </CardContent>
                    </Card>
                ) : approachingLimits ? (
                    <ApproachingLimitsTable data={approachingLimits} />
                ) : null}

                {/* Per-customer drill-down — disabled pending backend endpoints */}
                <Card className="border-dashed">
                    <CardHeader>
                        <CardTitle>{t('admin-billing.metrics.searchTitle')}</CardTitle>
                        <CardDescription>
                            {t('admin-billing.metrics.searchDescription')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            {t('admin-billing.metrics.searchDisabled')}
                        </p>
                    </CardContent>
                </Card>
            </div>
        </SidebarPageLayout>
    );
}
