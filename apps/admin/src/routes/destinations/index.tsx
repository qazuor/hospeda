import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import type { DataTableColumn, DataTableSort } from '@/components/table/DataTable';
import { DataTable } from '@/components/table/DataTable';
import { DataTableToolbar } from '@/components/table/DataTableToolbar';
import { useToast } from '@/components/ui/ToastProvider';
import { useDestinationsQuery } from '@/features/destinations/hooks/useDestinationsQuery';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';

export const Route = createFileRoute('/destinations/')({
    validateSearch: (search: Record<string, unknown>) => {
        const num = (v: unknown, d: number) => {
            const n = Number(v);
            return Number.isFinite(n) && n > 0 ? n : d;
        };
        const page = num(search.page, 1);
        const pageSize = [10, 20, 30, 50].includes(Number(search.pageSize))
            ? Number(search.pageSize)
            : 10;
        const view = search.view === 'grid' ? 'grid' : 'table';
        const q = typeof search.q === 'string' ? search.q : '';
        const sort = typeof search.sort === 'string' ? search.sort : undefined;
        const cols = typeof search.cols === 'string' ? search.cols : undefined;
        return { page, pageSize, view, q, sort, cols } as const;
    },
    component: () => <DestinationsPage />
});

type Row = {
    id: string;
    name: string;
    slug: string;
    country?: string;
    city?: string;
    status?: string;
    updatedAt?: string;
};

const DestinationsPage = () => {
    const navigate = useNavigate({ from: '/destinations' });
    const search = Route.useSearch();

    const parsedSort: DataTableSort = useMemo(() => {
        if (!search.sort) return [];
        try {
            const s = JSON.parse(search.sort) as DataTableSort;
            return Array.isArray(s) ? s : [];
        } catch {
            return [];
        }
    }, [search.sort]);

    const columnVisibility: Record<string, boolean> = useMemo(() => {
        if (!search.cols) return {};
        try {
            const v = JSON.parse(search.cols) as Record<string, boolean>;
            return v && typeof v === 'object' ? v : {};
        } catch {
            return {};
        }
    }, [search.cols]);

    const { data, isLoading, error } = useDestinationsQuery({
        page: search.page,
        pageSize: search.pageSize,
        q: search.q,
        sort: parsedSort
    });
    const { addToast } = useToast();
    useEffect(() => {
        if (error) {
            addToast({
                title: 'Failed to load destinations',
                message: error.message ?? 'Unknown error',
                variant: 'error'
            });
        }
    }, [error, addToast]);
    const rows: Row[] = data?.data ?? [];
    const total = data?.total ?? 0;

    const columns = useMemo<readonly DataTableColumn<Row>[]>(
        () => [
            { id: 'name', header: 'Name', accessorKey: 'name', enableSorting: true },
            { id: 'slug', header: 'Slug', accessorKey: 'slug', enableSorting: true },
            { id: 'city', header: 'City', accessorKey: 'city', enableSorting: false },
            {
                id: 'country',
                header: 'Country',
                accessorKey: 'country',
                enableSorting: false
            },
            {
                id: 'status',
                header: 'Status',
                accessorKey: 'status',
                enableSorting: true
            },
            {
                id: 'updatedAt',
                header: 'Updated',
                accessorKey: 'updatedAt',
                enableSorting: true
            }
        ],
        []
    );

    const availableColumns = useMemo(
        () => columns.map((c) => ({ id: c.id, label: String(c.header) })),
        [columns]
    );

    const updateSearch = (updater: (prev: typeof search) => typeof search) => {
        navigate({
            search: updater
        });
    };

    const handleViewChange = (next: 'table' | 'grid') =>
        updateSearch((prev) => ({ ...prev, view: next }));
    const handleQueryChange = (q: string) => updateSearch((prev) => ({ ...prev, q, page: 1 }));
    const handlePageChange = (p: number) => updateSearch((prev) => ({ ...prev, page: p }));
    const handlePageSizeChange = (n: number) =>
        updateSearch((prev) => ({ ...prev, pageSize: n, page: 1 }));
    const handleSortChange = (s: DataTableSort) =>
        updateSearch((prev) => ({ ...prev, sort: JSON.stringify(s) }));
    const handleColsChange = (v: Record<string, boolean>) =>
        updateSearch((prev) => ({ ...prev, cols: JSON.stringify(v) }));

    return (
        <SidebarPageLayout title="Destinations - List">
            <div className="space-y-4">
                <DataTableToolbar
                    view={search.view}
                    onViewChange={handleViewChange}
                    query={search.q}
                    onQueryChange={handleQueryChange}
                    columnVisibility={columnVisibility}
                    onColumnVisibilityChange={handleColsChange}
                    availableColumns={availableColumns}
                />

                {search.view === 'table' ? (
                    <DataTable<Row>
                        columns={columns}
                        data={rows}
                        total={total}
                        rowId={(r) => r.id}
                        loading={isLoading}
                        page={search.page}
                        pageSize={search.pageSize}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                        sort={parsedSort}
                        onSortChange={handleSortChange}
                        columnVisibility={columnVisibility}
                        onColumnVisibilityChange={handleColsChange}
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {isLoading ? (
                            <div className="text-muted-foreground text-sm">Loading...</div>
                        ) : rows.length === 0 ? (
                            <div className="text-muted-foreground text-sm">No records found</div>
                        ) : (
                            rows.map((r) => (
                                <article
                                    key={r.id}
                                    className="rounded-md border p-4"
                                >
                                    <div className="font-semibold">{r.name}</div>
                                    <div className="text-muted-foreground text-sm">
                                        {r.city}, {r.country}
                                    </div>
                                    <div className="text-muted-foreground text-xs">{r.slug}</div>
                                </article>
                            ))
                        )}
                    </div>
                )}
            </div>
        </SidebarPageLayout>
    );
};
