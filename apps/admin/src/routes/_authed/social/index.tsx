/**
 * @file _authed/social/index.tsx
 * @description Admin social pipeline dashboard page (SPEC-254 T-041).
 *
 * The landing page for the social module at `/social`.
 * Renders:
 * - KPI cards (total / pending / scheduled / published / failed)
 * - Make webhook alert when the webhook URL is not configured
 * - Quick-approval queue with optimistic inline approve action
 * - Recent failures section
 *
 * Permission guard: SOCIAL_POST_VIEW (enforced server-side and via RoutePermissionGuard).
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { useSocialDashboard } from '@/hooks/use-social-posts';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';

import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { DashboardDateRangeFilter } from './-components/DashboardDateRangeFilter';
import { DashboardKpiCards } from './-components/DashboardKpiCards';
import { PlatformBreakdownChart } from './-components/PlatformBreakdownChart';
import { QuickApprovalQueue, QuickApprovalQueueSkeleton } from './-components/QuickApprovalQueue';
import { RecentFailures, RecentFailuresSkeleton } from './-components/RecentFailures';
import { WebhookAlert } from './-components/WebhookAlert';

/** Search params for the dashboard's optional date-range filter (HOS-66 T-009). */
const SocialDashboardSearchSchema = z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional()
});

type SocialDashboardSearch = z.infer<typeof SocialDashboardSearchSchema>;

export const Route = createFileRoute('/_authed/social/')({
    component: SocialDashboardPage,
    validateSearch: SocialDashboardSearchSchema,
    errorComponent: createErrorComponent('SocialDashboard'),
    pendingComponent: createPendingComponent()
});

/** Stable keys for the KPI skeleton grid. */
const KPI_SKELETON_KEYS = ['ksk-1', 'ksk-2', 'ksk-3', 'ksk-4', 'ksk-5'] as const;

/** Admin social pipeline dashboard page. */
function SocialDashboardPage() {
    const { t } = useTranslations();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const { data, isLoading, error } = useSocialDashboard(search);

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.SOCIAL_POST_VIEW]}>
            <div
                className="space-y-8 p-6"
                data-testid="social-dashboard"
            >
                {/* Header */}
                <h1 className="font-bold text-2xl">{t('social.dashboard.title')}</h1>

                {/* Date-range filter */}
                <DashboardDateRangeFilter
                    dateFrom={search.dateFrom}
                    dateTo={search.dateTo}
                    onChangeDateFrom={(dateFrom) =>
                        void navigate({
                            search: (prev: SocialDashboardSearch) => ({ ...prev, dateFrom })
                        })
                    }
                    onChangeDateTo={(dateTo) =>
                        void navigate({
                            search: (prev: SocialDashboardSearch) => ({ ...prev, dateTo })
                        })
                    }
                />

                {/* Error state */}
                {error && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                        data-testid="dashboard-error"
                    >
                        {t('social.dashboard.error')}
                    </p>
                )}

                {/* Webhook alert — shown only when webhook is missing */}
                {!isLoading && !error && data != null && !data.makeWebhookConfigured && (
                    <WebhookAlert />
                )}

                {/* KPI cards skeleton */}
                {isLoading && (
                    <div
                        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
                        data-testid="kpi-skeleton"
                    >
                        {KPI_SKELETON_KEYS.map((k) => (
                            <div
                                key={k}
                                className="h-24 animate-pulse rounded-lg bg-muted"
                            />
                        ))}
                    </div>
                )}

                {/* KPI cards */}
                {!isLoading && !error && data != null && <DashboardKpiCards kpis={data.kpis} />}

                {/* Per-platform breakdown */}
                {!isLoading && !error && data != null && (
                    <PlatformBreakdownChart data={data.platformBreakdown} />
                )}

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                    {/* Quick approval queue */}
                    {isLoading ? (
                        <QuickApprovalQueueSkeleton />
                    ) : (
                        !error &&
                        data != null && <QuickApprovalQueue items={data.quickApprovalQueue} />
                    )}

                    {/* Recent failures */}
                    {isLoading ? (
                        <RecentFailuresSkeleton />
                    ) : (
                        !error && data != null && <RecentFailures items={data.recentFailures} />
                    )}
                </div>
            </div>
        </RoutePermissionGuard>
    );
}
