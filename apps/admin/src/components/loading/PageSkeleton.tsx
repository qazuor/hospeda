/**
 * Page Skeleton Components for Lazy Loading
 *
 * Provides consistent loading states for different page types.
 * Used with React Suspense and TanStack Router lazy loading.
 */

import { LoaderIcon } from '@repo/icons';

/**
 * Skeleton for entity list pages (tables/grids)
 */
export const EntityListSkeleton = () => {
    return (
        <div className="animate-pulse space-y-4 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="h-8 w-48 rounded bg-gray-200" />
                <div className="h-10 w-32 rounded bg-gray-200" />
            </div>

            {/* Breadcrumbs */}
            <div className="flex gap-2">
                <div className="h-4 w-16 rounded bg-gray-200" />
                <div className="h-4 w-4 rounded bg-gray-200" />
                <div className="h-4 w-24 rounded bg-gray-200" />
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between pt-4">
                <div className="flex gap-2">
                    <div className="h-10 w-64 rounded bg-gray-200" />
                    <div className="h-10 w-24 rounded bg-gray-200" />
                </div>
                <div className="flex gap-2">
                    <div className="h-10 w-10 rounded bg-gray-200" />
                    <div className="h-10 w-10 rounded bg-gray-200" />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border">
                {/* Table header */}
                <div className="flex gap-4 border-b bg-gray-50 px-4 py-3">
                    <div className="h-4 w-8 rounded bg-gray-200" />
                    <div className="h-4 w-32 rounded bg-gray-200" />
                    <div className="h-4 w-24 rounded bg-gray-200" />
                    <div className="h-4 w-20 rounded bg-gray-200" />
                    <div className="h-4 w-16 rounded bg-gray-200" />
                    <div className="h-4 w-20 rounded bg-gray-200" />
                </div>

                {/* Table rows */}
                {Array.from({ length: 8 }).map((_, i) => (
                    <div
                        key={`row-${i.toString()}`}
                        className="flex gap-4 border-b px-4 py-4"
                    >
                        <div className="h-4 w-8 rounded bg-gray-200" />
                        <div className="h-4 w-32 rounded bg-gray-200" />
                        <div className="h-4 w-24 rounded bg-gray-200" />
                        <div className="h-4 w-20 rounded bg-gray-200" />
                        <div className="h-4 w-16 rounded bg-gray-200" />
                        <div className="h-4 w-20 rounded bg-gray-200" />
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2">
                <div className="h-4 w-32 rounded bg-gray-200" />
                <div className="flex gap-2">
                    <div className="h-8 w-8 rounded bg-gray-200" />
                    <div className="h-8 w-8 rounded bg-gray-200" />
                    <div className="h-8 w-8 rounded bg-gray-200" />
                </div>
            </div>
        </div>
    );
};

/**
 * Skeleton for entity detail/edit pages (forms)
 */
export const EntityFormSkeleton = () => {
    return (
        <div className="animate-pulse space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="h-8 w-64 rounded bg-gray-200" />
                <div className="flex gap-2">
                    <div className="h-10 w-24 rounded bg-gray-200" />
                    <div className="h-10 w-24 rounded bg-gray-200" />
                </div>
            </div>

            {/* Breadcrumbs */}
            <div className="flex gap-2">
                <div className="h-4 w-16 rounded bg-gray-200" />
                <div className="h-4 w-4 rounded bg-gray-200" />
                <div className="h-4 w-24 rounded bg-gray-200" />
                <div className="h-4 w-4 rounded bg-gray-200" />
                <div className="h-4 w-32 rounded bg-gray-200" />
            </div>

            {/* Form sections */}
            <div className="grid gap-6 pt-4 lg:grid-cols-3">
                {/* Main form */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Section 1 */}
                    <div className="rounded-lg border p-6">
                        <div className="mb-4 h-6 w-32 rounded bg-gray-200" />
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="h-4 w-20 rounded bg-gray-200" />
                                <div className="h-10 w-full rounded bg-gray-200" />
                            </div>
                            <div className="space-y-2">
                                <div className="h-4 w-24 rounded bg-gray-200" />
                                <div className="h-24 w-full rounded bg-gray-200" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="h-4 w-16 rounded bg-gray-200" />
                                    <div className="h-10 w-full rounded bg-gray-200" />
                                </div>
                                <div className="space-y-2">
                                    <div className="h-4 w-20 rounded bg-gray-200" />
                                    <div className="h-10 w-full rounded bg-gray-200" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2 */}
                    <div className="rounded-lg border p-6">
                        <div className="mb-4 h-6 w-24 rounded bg-gray-200" />
                        <div className="grid grid-cols-2 gap-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={`field-${i.toString()}`}
                                    className="space-y-2"
                                >
                                    <div className="h-4 w-20 rounded bg-gray-200" />
                                    <div className="h-10 w-full rounded bg-gray-200" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    <div className="rounded-lg border p-4">
                        <div className="mb-3 h-5 w-16 rounded bg-gray-200" />
                        <div className="h-10 w-full rounded bg-gray-200" />
                    </div>
                    <div className="rounded-lg border p-4">
                        <div className="mb-3 h-5 w-20 rounded bg-gray-200" />
                        <div className="space-y-2">
                            <div className="h-4 w-full rounded bg-gray-200" />
                            <div className="h-4 w-3/4 rounded bg-gray-200" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Skeleton for dashboard pages
 */
export const DashboardSkeleton = () => {
    return (
        <div className="animate-pulse space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="h-8 w-32 rounded bg-gray-200" />
                <div className="flex gap-2">
                    <div className="h-10 w-24 rounded bg-gray-200" />
                    <div className="h-10 w-24 rounded bg-gray-200" />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={`kpi-${i.toString()}`}
                        className="rounded-lg border p-4"
                    >
                        <div className="mb-3 h-4 w-20 rounded bg-gray-200" />
                        <div className="flex items-end justify-between">
                            <div className="h-8 w-16 rounded bg-gray-200" />
                            <div className="h-6 w-12 rounded bg-gray-200" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-lg border p-4 lg:col-span-2">
                    <div className="mb-4 h-5 w-32 rounded bg-gray-200" />
                    <div className="h-48 w-full rounded bg-gray-200" />
                </div>
                <div className="rounded-lg border p-4">
                    <div className="mb-4 h-5 w-24 rounded bg-gray-200" />
                    <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div
                                key={`activity-${i.toString()}`}
                                className="h-10 w-full rounded bg-gray-200"
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Generic page skeleton
 */
export const PageSkeleton = () => {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <LoaderIcon className="h-12 w-12 animate-spin text-cyan-600" />
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            </div>
        </div>
    );
};
