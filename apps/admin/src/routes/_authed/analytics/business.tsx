import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQueries } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/analytics/business')({
    component: AnalyticsBusinessPage
});

import { fetchApi } from '@/lib/api/client';

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

const ENTITIES = [
    { name: 'Accommodations', endpoint: '/admin/accommodations', key: 'accommodations' },
    { name: 'Destinations', endpoint: '/admin/destinations', key: 'destinations' },
    { name: 'Events', endpoint: '/admin/events', key: 'events' },
    { name: 'Posts', endpoint: '/admin/posts', key: 'posts' },
    { name: 'Attractions', endpoint: '/admin/attractions', key: 'attractions' }
];

function AnalyticsBusinessPage() {
    const queries = useQueries({
        queries: ENTITIES.map((entity) => ({
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
                    <h2 className="mb-2 font-bold text-2xl">Total Entities</h2>
                    <p className="text-muted-foreground">
                        Overview of all content entities in the system
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {ENTITIES.map((entity, index) => {
                        const query = queries[index];
                        const count = query.data ?? 0;

                        return (
                            <Card key={entity.key}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="font-medium text-sm">
                                        {entity.name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="font-bold text-2xl">
                                        {isLoading ? '...' : count}
                                    </div>
                                    <p className="mt-1 text-muted-foreground text-xs">
                                        Total count
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Status Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            Detailed analytics by status (draft, published, archived) coming soon.
                        </p>
                        <p className="mt-2 text-muted-foreground text-sm">
                            Currently showing total entity counts only.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </SidebarPageLayout>
    );
}
