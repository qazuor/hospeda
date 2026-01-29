import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQueries } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/analytics/business')({
    component: AnalyticsBusinessPage
});

const API_BASE = '/api/v1';

async function fetchEntityCount(endpoint: string): Promise<number> {
    const response = await fetch(`${API_BASE}${endpoint}?page=1&limit=1`, {
        credentials: 'include'
    });
    if (!response.ok) return 0;
    const json = await response.json();
    return json.data?.pagination?.total ?? json.metadata?.total ?? 0;
}

const ENTITIES = [
    { name: 'Accommodations', endpoint: '/public/accommodations', key: 'accommodations' },
    { name: 'Destinations', endpoint: '/public/destinations', key: 'destinations' },
    { name: 'Events', endpoint: '/public/events', key: 'events' },
    { name: 'Posts', endpoint: '/public/posts', key: 'posts' },
    { name: 'Attractions', endpoint: '/public/attractions', key: 'attractions' }
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
