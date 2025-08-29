/**
 * @file Enhanced Accommodations Routes Example
 *
 * This file demonstrates how to use the new server functions and TanStack Query
 * integration with TanStack Router for optimal performance and user experience.
 *
 * This is an example file showing the enhanced approach - not meant to replace
 * existing routes immediately, but to demonstrate the new patterns.
 */

import { Icon } from '@/components/icons';
import { BaseLayout } from '@/components/layouts/BaseLayout';
import { Button } from '@/components/ui-wrapped';
import { adminLogger } from '@/utils/logger';
import { createFileRoute, useParams } from '@tanstack/react-router';
import { z } from 'zod';
import {
    useAccommodationDetailSimple,
    useAccommodationsCacheSimple,
    useDeleteAccommodationSimple,
    useUpdateAccommodationSimple
} from '../hooks/useAccommodationsSimple';
import type { Accommodation } from '../server/accommodations-server.config';
import { getAccommodationSimple } from '../server/accommodations-simple-functions';

/**
 * Type for accommodation data from server
 */
type AccommodationData = {
    readonly name?: string;
    readonly type?: string;
    readonly status?: string;
    readonly capacity?: number;
    readonly currency?: string;
    readonly pricePerNight?: number;
    readonly description?: string;
    readonly [key: string]: unknown;
};

/**
 * Search params schema for accommodation routes
 */
const accommodationSearchSchema = z.object({
    tab: z.enum(['details', 'media', 'location', 'pricing']).optional(),
    edit: z.boolean().optional()
});

/**
 * Enhanced accommodation detail route with server function integration
 */
export const EnhancedAccommodationDetailRoute = createFileRoute('/_authed/accommodations/$id/')({
    validateSearch: accommodationSearchSchema,

    // Use server function for route loader with prefetching
    loader: async ({ params }) => {
        // The server function handles validation, auth, and caching
        const result = await getAccommodationSimple({ data: { id: params.id } });

        const anyResult = result as {
            success: boolean;
            data?: Record<string, unknown>;
            meta?: Record<string, unknown>;
            error?: { message: string };
        };
        if (anyResult && !anyResult.success) {
            throw new Error(anyResult.error?.message || 'Failed to load accommodation');
        }

        return {
            accommodation: anyResult?.data || {},
            meta: anyResult?.meta || {}
        };
    },

    // Error boundary for route-level errors
    errorComponent: ({ error }) => (
        <BaseLayout title="Error">
            <div className="flex min-h-[400px] flex-col items-center justify-center">
                <Icon
                    name="alert-triangle"
                    size="xl"
                    variant="error"
                    className="mb-4"
                />
                <h2 className="mb-2 font-semibold text-xl">Failed to load accommodation</h2>
                <p className="text-gray-600">{error.message}</p>
            </div>
        </BaseLayout>
    ),

    component: EnhancedAccommodationDetailPage
});

/**
 * Enhanced accommodation detail page component
 */
function EnhancedAccommodationDetailPage() {
    const params = useParams({ strict: false });
    const search = EnhancedAccommodationDetailRoute.useSearch();
    const accommodationId = (params as Record<string, unknown>).id as string;

    // Use the enhanced hook with server function integration
    const {
        data: accommodation,
        isLoading,
        error,
        invalidate
    } = useAccommodationDetailSimple(accommodationId, {
        // Data is already prefetched by the loader, so this will use cached data
        staleTime: 5 * 60 * 1000 // 5 minutes
    });

    // Mutation hooks with optimistic updates
    const updateMutation = useUpdateAccommodationSimple({
        optimistic: true,
        onSuccess: () => {
            // Show success notification
            adminLogger.log('Accommodation updated successfully');
        },
        onError: (error) => {
            // Show error notification
            adminLogger.error(error, 'Failed to update accommodation');
        }
    });

    const deleteMutation = useDeleteAccommodationSimple({
        optimistic: true,
        onSuccess: () => {
            // Redirect to list after successful deletion
            window.location.href = '/accommodations';
        }
    });

    // Cache management utilities (commented out for now)
    // const cache = useAccommodationsCacheSimple();

    if (isLoading) {
        return (
            <BaseLayout title="Loading...">
                <div className="flex min-h-[400px] items-center justify-center">
                    <Icon
                        name="loader"
                        size="xl"
                        className="animate-spin"
                    />
                </div>
            </BaseLayout>
        );
    }

    if (error || !accommodation) {
        return (
            <BaseLayout title="Error">
                <div className="flex min-h-[400px] flex-col items-center justify-center">
                    <Icon
                        name="alert-triangle"
                        size="xl"
                        variant="error"
                        className="mb-4"
                    />
                    <h2 className="mb-2 font-semibold text-xl">Accommodation not found</h2>
                    <p className="text-gray-600">
                        {error?.message || 'The accommodation could not be loaded.'}
                    </p>
                </div>
            </BaseLayout>
        );
    }

    const breadcrumbs = [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Accommodations', href: '/accommodations' },
        { label: String((accommodation as AccommodationData)?.name || 'Accommodation') }
    ];

    const actions = (
        <div className="flex gap-2">
            <Button
                variant="outline"
                onClick={() => invalidate()}
                disabled={isLoading}
            >
                <Icon
                    name="refresh"
                    size="sm"
                    className="mr-2"
                />
                Refresh
            </Button>

            <Button
                variant="outline"
                onClick={() => {
                    // Toggle edit mode
                    const newSearch = { ...search, edit: !search.edit };
                    // Navigate with new search params
                    const searchParams = new URLSearchParams();
                    for (const [key, value] of Object.entries(newSearch)) {
                        if (value !== undefined && value !== null) {
                            searchParams.set(key, String(value));
                        }
                    }
                    window.history.pushState({}, '', `?${searchParams.toString()}`);
                }}
            >
                <Icon
                    name="edit"
                    size="sm"
                    className="mr-2"
                />
                {search.edit ? 'Cancel Edit' : 'Edit'}
            </Button>

            <Button
                variant="destructive"
                onClick={() => {
                    if (confirm('Are you sure you want to delete this accommodation?')) {
                        deleteMutation.mutate({ id: accommodationId });
                    }
                }}
                loading={deleteMutation.isPending}
            >
                <Icon
                    name="delete"
                    size="sm"
                    className="mr-2"
                />
                Delete
            </Button>
        </div>
    );

    return (
        <BaseLayout
            title={`${accommodation.name} - ${search.edit ? 'Edit' : 'View'}`}
            breadcrumbs={breadcrumbs}
            actions={actions}
        >
            {search.edit ? (
                <div className="space-y-6">
                    <div className="rounded-lg border bg-card p-6">
                        <h3 className="mb-4 font-semibold text-lg">Edit Mode</h3>
                        <p className="text-muted-foreground">
                            Edit functionality would be implemented here using the accommodation
                            data and the updateMutation hook.
                        </p>
                        <div className="mt-4 flex gap-2">
                            <Button
                                onClick={async () => {
                                    // Simulate save
                                    await updateMutation.mutateAsync({
                                        id: accommodationId,
                                        data: { name: `${accommodation?.name} (Updated)` }
                                    });

                                    // Exit edit mode after successful save
                                    const newSearch = { ...search, edit: false };
                                    const searchParams = new URLSearchParams();
                                    for (const [key, value] of Object.entries(newSearch)) {
                                        if (value !== undefined && value !== null) {
                                            searchParams.set(key, String(value));
                                        }
                                    }
                                    window.history.pushState({}, '', `?${searchParams.toString()}`);
                                }}
                                loading={updateMutation.isPending}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="rounded-lg border bg-card p-6">
                        <h3 className="mb-4 font-semibold text-lg">Accommodation Details</h3>
                        <div className="grid gap-4">
                            <div>
                                <div className="font-medium text-sm">Name</div>
                                <p className="text-muted-foreground text-sm">
                                    {String((accommodation as AccommodationData)?.name || '')}
                                </p>
                            </div>
                            <div>
                                <div className="font-medium text-sm">Type</div>
                                <p className="text-muted-foreground text-sm">
                                    {String((accommodation as AccommodationData)?.type || '')}
                                </p>
                            </div>
                            <div>
                                <div className="font-medium text-sm">Status</div>
                                <p className="text-muted-foreground text-sm">
                                    {String((accommodation as AccommodationData)?.status || '')}
                                </p>
                            </div>
                            <div>
                                <div className="font-medium text-sm">Capacity</div>
                                <p className="text-muted-foreground text-sm">
                                    {String((accommodation as AccommodationData)?.capacity || '')}{' '}
                                    guests
                                </p>
                            </div>
                            <div>
                                <div className="font-medium text-sm">Price per Night</div>
                                <p className="text-muted-foreground text-sm">
                                    {String((accommodation as AccommodationData)?.currency || '')}{' '}
                                    {String(
                                        (accommodation as AccommodationData)?.pricePerNight || ''
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </BaseLayout>
    );
}

/**
 * Example of how to use the cache management utilities
 */
export function AccommodationCacheExample() {
    const cache = useAccommodationsCacheSimple();

    const handleCacheOperations = {
        // Invalidate all accommodation queries
        invalidateAll: () => cache.invalidateAll(),

        // Invalidate just the lists
        invalidateLists: () => cache.invalidateLists(),

        // Prefetch a specific accommodation
        prefetchAccommodation: (id: string) => cache.prefetchDetail(id),

        // Get cached data without triggering a request
        getCachedAccommodation: (id: string) => cache.getDetailData(id),

        // Manually update cache (for optimistic updates)
        updateCache: (id: string, data: Accommodation) => cache.setDetailData(id, data)
    };

    return (
        <div className="space-y-2">
            <Button onClick={handleCacheOperations.invalidateAll}>Invalidate All Cache</Button>
            <Button onClick={handleCacheOperations.invalidateLists}>Invalidate Lists Only</Button>
            {/* More cache operation buttons... */}
        </div>
    );
}
