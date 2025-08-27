import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdvancedCache } from '@/lib/cache/hooks/useAdvancedCache';
import { cn } from '@/lib/utils';
import { DeleteIcon, RefreshIcon, StatisticsIcon } from '@repo/icons';
import type React from 'react';
import { useEffect, useState } from 'react';

/**
 * Props for CacheMonitor component
 */
export type CacheMonitorProps = {
    /** Whether to show detailed analytics */
    readonly showDetails?: boolean;
    /** Refresh interval in milliseconds */
    readonly refreshInterval?: number;
    /** Additional CSS classes */
    readonly className?: string;
    /** Whether to enable real-time monitoring */
    readonly realTime?: boolean;
};

/**
 * Cache monitoring and analytics component
 *
 * Provides real-time visualization of cache performance, memory usage,
 * and operation statistics with interactive controls for cache management.
 *
 * @example
 * ```tsx
 * <CacheMonitor
 *   showDetails={true}
 *   refreshInterval={5000}
 *   realTime={true}
 * />
 * ```
 */
export const CacheMonitor: React.FC<CacheMonitorProps> = ({
    showDetails = false,
    refreshInterval = 5000,
    className,
    realTime = false
}) => {
    const { analytics, cleanup, clearAnalytics, isMonitoring, startMonitoring, stopMonitoring } =
        useAdvancedCache({
            autoStart: true,
            debug: false
        });

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(Date.now());

    // Auto-refresh analytics
    useEffect(() => {
        if (!realTime) return;

        const interval = setInterval(() => {
            setLastRefresh(Date.now());
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [realTime, refreshInterval]);

    // Handle manual refresh
    const handleRefresh = async () => {
        setIsRefreshing(true);
        // Small delay to show loading state
        await new Promise((resolve) => setTimeout(resolve, 300));
        setLastRefresh(Date.now());
        setIsRefreshing(false);
    };

    // Handle cleanup
    const handleCleanup = async () => {
        await cleanup(false);
        setLastRefresh(Date.now());
    };

    // Handle force cleanup
    const handleForceCleanup = async () => {
        await cleanup(true);
        setLastRefresh(Date.now());
    };

    if (!analytics) {
        return (
            <Card className={cn('w-full', className)}>
                <CardContent className="flex items-center justify-center p-6">
                    <p className="text-gray-500 text-sm">Cache analytics not available</p>
                </CardContent>
            </Card>
        );
    }

    const { cacheStats, invalidation, warming, memory } = analytics;

    // Calculate health score (0-100)
    const healthScore = Math.round(
        (100 - cacheStats.memoryPressure * 50) *
            (invalidation.successRate / 100) *
            (warming.successRate / 100)
    );

    const getHealthColor = (score: number) => {
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    // Removed unused formatBytes function

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    };

    return (
        <div className={cn('space-y-4', className)}>
            {/* Header with controls */}
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-lg">Cache Monitor</h2>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                    >
                        <RefreshIcon className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={isMonitoring ? stopMonitoring : startMonitoring}
                    >
                        <StatisticsIcon className="h-4 w-4" />
                        {isMonitoring ? 'Stop' : 'Start'} Monitoring
                    </Button>
                </div>
            </div>

            {/* Overview cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {/* Health Score */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-600 text-sm">Health Score</p>
                                <p
                                    className={cn(
                                        'font-bold text-2xl',
                                        getHealthColor(healthScore)
                                    )}
                                >
                                    {healthScore}%
                                </p>
                            </div>
                            <StatisticsIcon
                                className={cn('h-8 w-8', getHealthColor(healthScore))}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Cache Size */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-600 text-sm">Cache Size</p>
                                <p className="font-bold text-2xl text-blue-600">
                                    {cacheStats.estimatedSizeMB.toFixed(1)}MB
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-gray-500 text-xs">
                                    {cacheStats.totalQueries} queries
                                </p>
                                <p className="text-gray-500 text-xs">
                                    {cacheStats.staleQueries} stale
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Memory Pressure */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-600 text-sm">Memory Pressure</p>
                                <p
                                    className={cn(
                                        'font-bold text-2xl',
                                        cacheStats.memoryPressure > 0.8
                                            ? 'text-red-600'
                                            : cacheStats.memoryPressure > 0.6
                                              ? 'text-yellow-600'
                                              : 'text-green-600'
                                    )}
                                >
                                    {(cacheStats.memoryPressure * 100).toFixed(0)}%
                                </p>
                            </div>
                            <div className="h-2 w-16 rounded-full bg-gray-200">
                                <div
                                    className={cn(
                                        'h-full rounded-full transition-all',
                                        cacheStats.memoryPressure > 0.8
                                            ? 'bg-red-500'
                                            : cacheStats.memoryPressure > 0.6
                                              ? 'bg-yellow-500'
                                              : 'bg-green-500'
                                    )}
                                    style={{
                                        width: `${Math.min(100, cacheStats.memoryPressure * 100)}%`
                                    }}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Operations */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-600 text-sm">
                                    Total Operations
                                </p>
                                <p className="font-bold text-2xl text-purple-600">
                                    {invalidation.totalInvalidations +
                                        warming.totalWarmings +
                                        memory.totalCleanups}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-gray-500 text-xs">
                                    {invalidation.totalInvalidations} invalidations
                                </p>
                                <p className="text-gray-500 text-xs">
                                    {warming.totalWarmings} warmings
                                </p>
                                <p className="text-gray-500 text-xs">
                                    {memory.totalCleanups} cleanups
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed analytics */}
            {showDetails && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {/* Invalidation Analytics */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Smart Invalidation</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-600 text-sm">Success Rate</span>
                                <span className="font-medium text-sm">
                                    {invalidation.successRate.toFixed(1)}%
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 text-sm">Avg Execution</span>
                                <span className="font-medium text-sm">
                                    {formatDuration(invalidation.averageExecutionTime)}
                                </span>
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium text-gray-700 text-sm">Top Strategies</p>
                                {invalidation.topStrategies.slice(0, 3).map((strategy) => (
                                    <div
                                        key={strategy.strategy}
                                        className="flex justify-between text-xs"
                                    >
                                        <span className="text-gray-600">{strategy.strategy}</span>
                                        <span className="font-medium">{strategy.count}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Cache Warming Analytics */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Cache Warming</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-600 text-sm">Success Rate</span>
                                <span className="font-medium text-sm">
                                    {warming.successRate.toFixed(1)}%
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 text-sm">Avg Execution</span>
                                <span className="font-medium text-sm">
                                    {formatDuration(warming.averageExecutionTime)}
                                </span>
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium text-gray-700 text-sm">Top Strategies</p>
                                {warming.topStrategies.slice(0, 3).map((strategy) => (
                                    <div
                                        key={strategy.strategy}
                                        className="flex justify-between text-xs"
                                    >
                                        <span className="text-gray-600">{strategy.strategy}</span>
                                        <span className="font-medium">{strategy.count}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Memory Analytics */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Memory Management</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-600 text-sm">Queries Removed</span>
                                <span className="font-medium text-sm">
                                    {memory.totalQueriesRemoved}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 text-sm">Memory Freed</span>
                                <span className="font-medium text-sm">
                                    {memory.totalMemoryFreedMB.toFixed(1)}MB
                                </span>
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium text-gray-700 text-sm">
                                    Cleanup Triggers
                                </p>
                                {Object.entries(memory.cleanupsByTrigger)
                                    .slice(0, 3)
                                    .map(([trigger, count]) => (
                                        <div
                                            key={trigger}
                                            className="flex justify-between text-xs"
                                        >
                                            <span className="text-gray-600">{trigger}</span>
                                            <span className="font-medium">{count}</span>
                                        </div>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-4">
                <div>
                    <p className="font-medium text-gray-900 text-sm">Cache Management</p>
                    <p className="text-gray-600 text-xs">
                        Last updated: {new Date(lastRefresh).toLocaleTimeString()}
                    </p>
                </div>
                <div className="flex space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCleanup}
                    >
                        <DeleteIcon className="h-4 w-4" />
                        Clean Cache
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleForceCleanup}
                    >
                        Force Clean
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAnalytics}
                    >
                        Clear Analytics
                    </Button>
                </div>
            </div>
        </div>
    );
};
