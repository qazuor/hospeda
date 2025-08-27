import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminLogger } from '@/utils/logger';
import { DeleteIcon, EditIcon, ViewAllIcon } from '@repo/icons';
import { Link } from '@tanstack/react-router';
import type React from 'react';
import { SimpleVirtualizedList, VirtualizedEntityListPage } from '../VirtualizedEntityListPage';
import { VIRTUALIZED_QUERY_PRESETS } from '../hooks/useVirtualizedEntityQuery';

/**
 * Example entity type for demonstration
 */
type ExampleEntity = {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly status: 'active' | 'inactive' | 'pending';
    readonly createdAt: string;
    readonly updatedAt: string;
};

/**
 * Props for VirtualizedEntityListExample
 */
export type VirtualizedEntityListExampleProps = {
    /** Entity name for queries */
    readonly entityName: string;
    /** API endpoint */
    readonly endpoint: string;
    /** Optional base parameters */
    readonly baseParams?: Record<string, unknown>;
    /** Container height */
    readonly height?: number;
    /** Show debug info */
    readonly showDebugInfo?: boolean;
    /** Preset configuration */
    readonly preset?: 'small' | 'medium' | 'large' | 'performance';
    /** Enable infinite loading */
    readonly enableInfiniteLoading?: boolean;
};

/**
 * Example component demonstrating virtualized entity lists
 *
 * Shows how to use VirtualizedEntityListPage with real data,
 * including custom item rendering, infinite loading, and performance optimization.
 *
 * @example
 * ```tsx
 * <VirtualizedEntityListExample
 *   entityName="accommodations"
 *   endpoint="/api/accommodations"
 *   preset="medium"
 *   height={600}
 *   showDebugInfo={true}
 * />
 * ```
 */
export const VirtualizedEntityListExample: React.FC<VirtualizedEntityListExampleProps> = ({
    entityName,
    endpoint,
    baseParams,
    height = 600,
    showDebugInfo = false,
    preset = 'medium',
    enableInfiniteLoading = true
}) => {
    // Custom item renderer
    const renderEntityItem = (entity: ExampleEntity, index: number) => (
        <Card className="mx-2 mb-2 transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <CardTitle className="font-semibold text-base text-gray-900">
                            {entity.title}
                        </CardTitle>
                        <p className="mt-1 line-clamp-2 text-gray-600 text-sm">
                            {entity.description}
                        </p>
                    </div>
                    <div className="ml-4 flex items-center gap-1">
                        <span
                            className={`inline-flex rounded-full px-2 py-1 font-medium text-xs ${
                                entity.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : entity.status === 'inactive'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                            }`}
                        >
                            {entity.status}
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                    <div className="text-gray-500 text-xs">
                        Item #{index + 1} • Created{' '}
                        {new Date(entity.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                        {/* View button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="View details"
                        >
                            <Link
                                // biome-ignore lint/suspicious/noExplicitAny: Dynamic route paths require any for type compatibility
                                to={`/${entityName}/$id` as any}
                                // biome-ignore lint/suspicious/noExplicitAny: Dynamic route params require any for type compatibility
                                params={{ id: entity.id } as any}
                            >
                                <ViewAllIcon className="h-4 w-4" />
                            </Link>
                        </Button>

                        {/* Edit button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Edit"
                        >
                            <Link
                                // biome-ignore lint/suspicious/noExplicitAny: Dynamic route paths require any for type compatibility
                                to={`/${entityName}/$id/edit` as any}
                                // biome-ignore lint/suspicious/noExplicitAny: Dynamic route params require any for type compatibility
                                params={{ id: entity.id } as any}
                            >
                                <EditIcon className="h-4 w-4" />
                            </Link>
                        </Button>

                        {/* Delete button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            title="Delete"
                            onClick={() => {
                                if (confirm('Are you sure you want to delete this item?')) {
                                    adminLogger.info('Delete item:', entity.id);
                                }
                            }}
                        >
                            <DeleteIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    // Custom empty state
    const emptyState = (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <svg
                className="mb-4 h-16 w-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <title>No items</title>
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
            </svg>
            <h3 className="mb-2 font-medium text-gray-900 text-lg">No {entityName} found</h3>
            <p className="text-sm">Try adjusting your search or filters</p>
        </div>
    );

    // Custom header
    const header = (
        <div className="flex items-center justify-between">
            <div>
                <h2 className="font-bold text-2xl text-gray-900">
                    Virtualized {entityName.charAt(0).toUpperCase() + entityName.slice(1)} List
                </h2>
                <p className="mt-1 text-gray-600 text-sm">
                    High-performance list with infinite loading and virtualization
                </p>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        adminLogger.info('Export data');
                    }}
                >
                    Export
                </Button>
                <Button
                    size="sm"
                    onClick={() => {
                        adminLogger.info('Add new item');
                    }}
                >
                    Add New
                </Button>
            </div>
        </div>
    );

    // Get preset config
    const presetConfig = VIRTUALIZED_QUERY_PRESETS[preset];
    const config = {
        ...presetConfig,
        enableInfiniteLoading
    };

    return (
        <div className="space-y-6">
            {/* Configuration info */}
            <div className="rounded-lg border bg-blue-50 p-4">
                <h3 className="font-medium text-blue-900">Configuration</h3>
                <div className="mt-2 grid grid-cols-2 gap-4 text-blue-800 text-sm md:grid-cols-4">
                    <div>
                        <span className="font-medium">Preset:</span> {preset}
                    </div>
                    <div>
                        <span className="font-medium">Item Size:</span>{' '}
                        {config.virtualization.estimateSize}px
                    </div>
                    <div>
                        <span className="font-medium">Page Size:</span> {config.pageSize}
                    </div>
                    <div>
                        <span className="font-medium">Infinite Loading:</span>{' '}
                        {enableInfiniteLoading ? 'Yes' : 'No'}
                    </div>
                </div>
            </div>

            {/* Full featured virtualized list */}
            <VirtualizedEntityListPage
                entityName={entityName}
                endpoint={endpoint}
                renderItem={renderEntityItem}
                config={config}
                baseParams={baseParams}
                height={height}
                header={header}
                emptyState={emptyState}
                showDebugInfo={showDebugInfo}
                showScrollIndicators={true}
            />

            {/* Simple version example */}
            <div className="mt-8">
                <h3 className="mb-4 font-semibold text-lg">Simple Version</h3>
                <p className="mb-4 text-gray-600 text-sm">
                    Using SimpleVirtualizedList for basic use cases:
                </p>

                <div className="rounded-lg border">
                    <SimpleVirtualizedList
                        entityName={entityName}
                        endpoint={endpoint}
                        renderItem={(entity: ExampleEntity, index) => (
                            <div className="border-b p-4 hover:bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-medium">{entity.title}</h4>
                                        <p className="text-gray-600 text-sm">Item #{index + 1}</p>
                                    </div>
                                    <span
                                        className={`rounded px-2 py-1 text-xs ${
                                            entity.status === 'active'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800'
                                        }`}
                                    >
                                        {entity.status}
                                    </span>
                                </div>
                            </div>
                        )}
                        preset="small"
                        height={300}
                        baseParams={baseParams}
                    />
                </div>
            </div>

            {/* Performance tips */}
            <div className="rounded-lg border bg-yellow-50 p-4">
                <h3 className="font-medium text-yellow-900">Performance Tips</h3>
                <ul className="mt-2 space-y-1 text-sm text-yellow-800">
                    <li>
                        • Use appropriate <code>estimateSize</code> for your items
                    </li>
                    <li>
                        • Adjust <code>overscan</code> based on scroll speed needs
                    </li>
                    <li>
                        • Consider <code>maxPages</code> for very large datasets
                    </li>
                    <li>
                        • Use <code>performance</code> preset for 10k+ items
                    </li>
                    <li>
                        • Memoize your <code>renderItem</code> function
                    </li>
                </ul>
            </div>
        </div>
    );
};

/**
 * Mock data generator for testing
 */
export const generateMockEntities = (count: number): ExampleEntity[] => {
    const statuses: ExampleEntity['status'][] = ['active', 'inactive', 'pending'];

    return Array.from({ length: count }, (_, index) => ({
        id: `entity-${index + 1}`,
        title: `Entity Item ${index + 1}`,
        description: `This is a description for entity item ${index + 1}. It contains some sample text to demonstrate how the virtualized list handles different content lengths.`,
        status: statuses[index % statuses.length] as ExampleEntity['status'],
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    }));
};

/**
 * Demo component with mock data
 */
export const VirtualizedEntityListDemo: React.FC = () => {
    // const mockEntities = generateMockEntities(1000);

    // Mock query function (for future use)
    // const mockQueryFn = async (page: number, pageSize: number) => {
    //     // Simulate API delay
    //     await new Promise((resolve) => setTimeout(resolve, 500));

    //     const start = (page - 1) * pageSize;
    //     const end = start + pageSize;
    //     const data = mockEntities.slice(start, end);

    //     return {
    //         data,
    //         total: mockEntities.length,
    //         page,
    //         pageSize,
    //         totalPages: Math.ceil(mockEntities.length / pageSize)
    //     };
    // };

    return (
        <div className="p-6">
            <VirtualizedEntityListExample
                entityName="demo-entities"
                endpoint="/api/demo-entities" // This would be mocked
                preset="medium"
                height={500}
                showDebugInfo={true}
                enableInfiniteLoading={true}
            />
        </div>
    );
};
