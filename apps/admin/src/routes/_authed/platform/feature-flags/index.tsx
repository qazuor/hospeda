import { DataTable } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchApi } from '@/lib/api/client';
import { AddIcon } from '@repo/icons';
import type { FeatureFlag } from '@repo/schemas';
import { useSuspenseQuery } from '@tanstack/react-query';
/**
 * Feature Flags list page — admin panel for managing feature flags (dark launch + kill switch).
 */
import { createFileRoute } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';

type FeatureFlagListResponse = {
    items: FeatureFlag[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
};

const columns: ColumnDef<FeatureFlag>[] = [
    {
        accessorKey: 'key',
        header: 'Key',
        cell: ({ row }) => (
            <div className="font-medium font-mono text-sm">{row.getValue('key')}</div>
        )
    },
    {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => {
            const description = row.getValue('description') as string;
            return (
                <div className="max-w-md truncate text-muted-foreground">{description || '—'}</div>
            );
        }
    },
    {
        accessorKey: 'enabled',
        header: 'Default',
        cell: ({ row }) => {
            const enabled = row.getValue('enabled') as boolean;
            return (
                <Badge variant={enabled ? 'default' : 'secondary'}>{enabled ? 'ON' : 'OFF'}</Badge>
            );
        }
    },
    {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) => {
            const isActive = row.getValue('isActive') as boolean;
            return (
                <Badge variant={isActive ? 'success' : 'destructive'}>
                    {isActive ? 'Active' : 'Killed'}
                </Badge>
            );
        }
    },
    {
        id: 'actions',
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    asChild
                >
                    <Link
                        to="/platform/feature-flags/$id"
                        params={{ id: row.original.id }}
                    >
                        View
                    </Link>
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    asChild
                >
                    <Link
                        to="/platform/feature-flags/$id_/edit"
                        params={{ id: row.original.id }}
                    >
                        Edit
                    </Link>
                </Button>
            </div>
        )
    }
];

function FeatureFlagsList() {
    const { data } = useSuspenseQuery<FeatureFlagListResponse>({
        queryKey: ['feature-flags', 'list'],
        queryFn: async () => {
            const response = await fetchApi({
                path: '/api/v1/admin/feature-flags?page=1&pageSize=50'
            });
            return response.data as FeatureFlagListResponse;
        }
    });

    return (
        <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="font-bold font-mono text-3xl">Feature Flags</h1>
                    <p className="text-muted-foreground">
                        Manage feature flags for dark launch and kill switch functionality
                    </p>
                </div>
                <Button asChild>
                    <Link to="/platform/feature-flags/new">
                        <AddIcon className="mr-2 h-4 w-4" />
                        Create Flag
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Feature Flags</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={data.items}
                        pagination={{
                            page: data.pagination.page,
                            pageSize: data.pagination.pageSize,
                            total: data.pagination.total,
                            totalPages: data.pagination.totalPages,
                            hasNextPage: data.pagination.hasNextPage,
                            hasPreviousPage: data.pagination.hasPreviousPage
                        }}
                        searchPlaceholder="Search flags by key or description..."
                        enableSearch
                        enableFilters={false}
                    />
                </CardContent>
            </Card>
        </div>
    );
}

export const Route = createFileRoute('/_authed/platform/feature-flags/')({
    component: FeatureFlagsList,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData({
            queryKey: ['feature-flags', 'list'],
            queryFn: async () => {
                const response = await fetchApi({
                    path: '/api/v1/admin/feature-flags?page=1&pageSize=50'
                });
                return response.data as FeatureFlagListResponse;
            }
        });
    }
});

export default FeatureFlagsList;
