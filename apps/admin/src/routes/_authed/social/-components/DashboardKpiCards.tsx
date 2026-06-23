/**
 * @file DashboardKpiCards.tsx
 * @description KPI counter cards for the social pipeline dashboard (SPEC-254 T-041).
 *
 * Renders five metric cards: totalPosts, pendingReview, scheduled,
 * publishedLast30Days, and failedActionNeeded.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import type { SocialDashboardKpis } from '@repo/schemas';

/** Props for {@link DashboardKpiCards}. */
export interface DashboardKpiCardsProps {
    readonly kpis: SocialDashboardKpis;
}

interface KpiCardItem {
    readonly key: keyof SocialDashboardKpis;
    readonly labelKey: TranslationKey;
    readonly colorClass: string;
    readonly testId: string;
}

/** Ordered list of KPI cards to render. */
const KPI_CARDS: readonly KpiCardItem[] = [
    {
        key: 'totalPosts',
        labelKey: 'social.dashboard.kpis.totalPosts',
        colorClass: 'text-foreground',
        testId: 'kpi-totalPosts'
    },
    {
        key: 'pendingReview',
        labelKey: 'social.dashboard.kpis.pendingReview',
        colorClass: 'text-yellow-600',
        testId: 'kpi-pendingReview'
    },
    {
        key: 'scheduled',
        labelKey: 'social.dashboard.kpis.scheduled',
        colorClass: 'text-indigo-600',
        testId: 'kpi-scheduled'
    },
    {
        key: 'publishedLast30Days',
        labelKey: 'social.dashboard.kpis.publishedLast30Days',
        colorClass: 'text-green-600',
        testId: 'kpi-publishedLast30Days'
    },
    {
        key: 'failedActionNeeded',
        labelKey: 'social.dashboard.kpis.failedActionNeeded',
        colorClass: 'text-red-600',
        testId: 'kpi-failedActionNeeded'
    }
] as const;

/**
 * Row of KPI metric cards for the social dashboard.
 *
 * @param props - {@link DashboardKpiCardsProps}
 */
export function DashboardKpiCards({ kpis }: DashboardKpiCardsProps) {
    const { t } = useTranslations();

    return (
        <div
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
            data-testid="dashboard-kpi-cards"
        >
            {KPI_CARDS.map((card) => (
                <Card
                    key={card.key}
                    data-testid={card.testId}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="font-medium text-muted-foreground text-sm">
                            {t(card.labelKey)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className={`font-bold text-3xl ${card.colorClass}`}>
                            {kpis[card.key]}
                        </span>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
