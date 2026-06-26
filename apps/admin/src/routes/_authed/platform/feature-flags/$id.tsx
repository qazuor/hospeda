import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchApi } from '@/lib/api/client';
import type { FeatureFlag } from '@repo/schemas';
import { useSuspenseQuery } from '@tanstack/react-query';
/**
 * View Feature Flag page — admin panel.
 */
import { createFileRoute } from '@tanstack/react-router';

function ViewFeatureFlag({ params }: { params: { id: string } }) {
    const { data: flag } = useSuspenseQuery<FeatureFlag>({
        queryKey: ['feature-flag', params.id],
        queryFn: async () => {
            const response = await fetchApi({ path: `/api/v1/admin/feature-flags/${params.id}` });
            return response.data as FeatureFlag;
        }
    });

    return (
        <div className="container mx-auto max-w-4xl py-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="font-bold font-mono text-3xl">{flag.key}</h1>
                    <p className="text-muted-foreground">{flag.description || 'No description'}</p>
                </div>
                <div className="flex gap-2">
                    <Button asChild>
                        <a href={`/platform/feature-flags/${flag.id}/edit`}>Edit</a>
                    </Button>
                    <Button
                        variant="outline"
                        asChild
                    >
                        <a href="/platform/feature-flags">Back to List</a>
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Status</CardTitle>
                        <CardDescription>Current flag state</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span>Active (Kill Switch)</span>
                            <Badge variant={flag.isActive ? 'success' : 'destructive'}>
                                {flag.isActive ? 'Active' : 'Killed'}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Enabled by Default</span>
                            <Badge variant={flag.enabled ? 'default' : 'secondary'}>
                                {flag.enabled ? 'ON' : 'OFF'}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Overrides</CardTitle>
                        <CardDescription>User and role-specific overrides</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="font-medium text-sm">Force ON Users</div>
                            <div className="text-muted-foreground text-sm">
                                {flag.forceOnUserIds?.length ?? 0} users
                            </div>
                        </div>
                        <div>
                            <div className="font-medium text-sm">Force OFF Users</div>
                            <div className="text-muted-foreground text-sm">
                                {flag.forceOffUserIds?.length ?? 0} users
                            </div>
                        </div>
                        <div>
                            <div className="font-medium text-sm">Enabled for Roles</div>
                            <div className="text-muted-foreground text-sm">
                                {flag.enabledForRoles?.join(', ') || 'None'}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Metadata</CardTitle>
                        <CardDescription>System information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">ID</span>
                            <span className="font-mono">{flag.id}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Created</span>
                            <span>{new Date(flag.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Updated</span>
                            <span>{new Date(flag.updatedAt).toLocaleDateString()}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Audit Log</CardTitle>
                        <CardDescription>Recent activity</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            variant="outline"
                            size="sm"
                            asChild
                        >
                            <a href={`/platform/feature-flags/${flag.id}/audit`}>View Audit Log</a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export const Route = createFileRoute('/_authed/platform/feature-flags/$id')({
    component: ViewFeatureFlag,
    loader: async ({ params, context }) => {
        await context.queryClient.ensureQueryData({
            queryKey: ['feature-flag', params.id],
            queryFn: async () => {
                const response = await fetchApi({
                    path: `/api/v1/admin/feature-flags/${params.id}`
                });
                return response.data as FeatureFlag;
            }
        });
    }
});

export default ViewFeatureFlag;
