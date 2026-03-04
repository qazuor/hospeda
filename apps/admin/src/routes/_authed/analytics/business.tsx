import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { fetchApi } from '@/lib/api/client';
import type { TranslationKey } from '@repo/i18n';
import { useQueries } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/analytics/business')({
    component: AnalyticsBusinessPage
});

async function fetchEntityCount(endpoint: string): Promise<number> {
    const result = await fetchApi<{
        success: boolean;
        data?: { pagination?: { total?: number } };
        metadata?: { total?: number };
    }>({
        path: `/api/v1${endpoint}?page=1&pageSize=1`
    });
    return result.data.data?.pagination?.total ?? result.data.metadata?.total ?? 0;
}

const ENTITY_KEYS = [
    {
        translationKey: 'entityAccommodations',
        endpoint: '/admin/accommodations',
        key: 'accommodations'
    },
    { translationKey: 'entityDestinations', endpoint: '/admin/destinations', key: 'destinations' },
    { translationKey: 'entityEvents', endpoint: '/admin/events', key: 'events' },
    { translationKey: 'entityPosts', endpoint: '/admin/posts', key: 'posts' },
    { translationKey: 'entityAttractions', endpoint: '/admin/attractions', key: 'attractions' }
];

function AnalyticsBusinessPage() {
    const { t } = useTranslations();
    const queries = useQueries({
        queries: ENTITY_KEYS.map((entity) => ({
            queryKey: ['entity-count', entity.key],
            queryFn: () => fetchEntityCount(entity.endpoint),
            staleTime: 5 * 60 * 1000 // 5 minutes
        }))
    });

    const isLoading = queries.some((q) => q.isLoading);

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.analyticsBusiness">
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-pages.analytics.business.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-pages.analytics.business.subtitle')}
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {ENTITY_KEYS.map((entity, index) => {
                        const query = queries[index];
                        const count = query.data ?? 0;

                        return (
                            <Card key={entity.key}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="font-medium text-sm">
                                        {t(
                                            `admin-pages.analytics.business.${entity.translationKey}` as TranslationKey
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="font-bold text-2xl">
                                        {isLoading ? '...' : count}
                                    </div>
                                    <p className="mt-1 text-muted-foreground text-xs">
                                        {t('admin-pages.analytics.business.totalCount')}
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-pages.analytics.business.statusBreakdown')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            {t('admin-pages.analytics.business.statusBreakdownDesc')}
                        </p>
                        <p className="mt-2 text-muted-foreground text-sm">
                            {t('admin-pages.analytics.business.totalCountNote')}
                        </p>
                    </CardContent>
                </Card>
            </div>
        </SidebarPageLayout>
    );
}
