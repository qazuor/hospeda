import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdvancedCache } from '@/lib/cache/hooks/useAdvancedCache';
import { adminLogger } from '@/utils/logger';
import type React from 'react';
import { useState } from 'react';
import { CacheMonitor } from '../CacheMonitor';

/**
 * Example demonstrating advanced cache strategies
 */
export const CacheExample: React.FC = () => {
    const [activeDemo, setActiveDemo] = useState<'monitor' | 'operations' | 'strategies'>(
        'monitor'
    );

    const {
        invalidate,
        warmCache,
        cleanup,
        warmRoute,
        invalidatePatterns,
        analytics,
        isMonitoring,
        startMonitoring,
        stopMonitoring
    } = useAdvancedCache({
        memoryOptimization: {
            maxCacheSizeMB: 50,
            maxQueries: 1000,
            autoCleanup: true,
            gcInterval: 2 * 60 * 1000 // 2 minutes for demo
        },
        enableCacheWarming: true,
        enableSmartInvalidation: true,
        autoStart: true,
        debug: true
    });

    // Demo operations
    const handleInvalidateUser = async () => {
        const result = await invalidate({
            entity: 'user',
            operation: 'update',
            data: { id: '123', email: 'updated@example.com' },
            timestamp: Date.now()
        });

        adminLogger.info('User invalidation result:', JSON.stringify(result));
    };

    const handleWarmDashboard = async () => {
        const result = await warmRoute('/dashboard');
        adminLogger.info('Dashboard warming result:', JSON.stringify(result));
    };

    const handleCleanupCache = async () => {
        const result = await cleanup();
        adminLogger.info('Cache cleanup result:', JSON.stringify(result));
    };

    const handleInvalidatePatterns = async () => {
        const result = await invalidatePatterns(['users', 'user-profile'], {
            refetchActive: true
        });
        adminLogger.info('Pattern invalidation result:', JSON.stringify(result));
    };

    const handleWarmUserData = async () => {
        const result = await warmCache({
            action: 'profile-view',
            timestamp: Date.now()
        });
        adminLogger.info('User data warming result:', JSON.stringify(result));
    };

    return (
        <div className="space-y-6">
            {/* Demo selector */}
            <div className="flex space-x-2">
                <Button
                    variant={activeDemo === 'monitor' ? 'default' : 'outline'}
                    onClick={() => setActiveDemo('monitor')}
                >
                    Cache Monitor
                </Button>
                <Button
                    variant={activeDemo === 'operations' ? 'default' : 'outline'}
                    onClick={() => setActiveDemo('operations')}
                >
                    Cache Operations
                </Button>
                <Button
                    variant={activeDemo === 'strategies' ? 'default' : 'outline'}
                    onClick={() => setActiveDemo('strategies')}
                >
                    Strategy Examples
                </Button>
            </div>

            {/* Cache Monitor Demo */}
            {activeDemo === 'monitor' && (
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Real-time Cache Monitor</CardTitle>
                            <p className="text-gray-600 text-sm">
                                Monitor cache performance, memory usage, and operation statistics in
                                real-time
                            </p>
                        </CardHeader>
                        <CardContent>
                            <CacheMonitor
                                showDetails={true}
                                refreshInterval={3000}
                                realTime={true}
                            />
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Cache Operations Demo */}
            {activeDemo === 'operations' && (
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Cache Operations Demo</CardTitle>
                            <p className="text-gray-600 text-sm">
                                Test different cache operations and see their effects
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Current stats */}
                            {analytics && (
                                <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 md:grid-cols-4">
                                    <div className="text-center">
                                        <p className="font-bold text-2xl text-blue-600">
                                            {analytics.cacheStats.totalQueries}
                                        </p>
                                        <p className="text-gray-600 text-sm">Total Queries</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-2xl text-green-600">
                                            {analytics.cacheStats.estimatedSizeMB.toFixed(1)}MB
                                        </p>
                                        <p className="text-gray-600 text-sm">Cache Size</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-2xl text-yellow-600">
                                            {analytics.invalidation.totalInvalidations}
                                        </p>
                                        <p className="text-gray-600 text-sm">Invalidations</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-2xl text-purple-600">
                                            {analytics.warming.totalWarmings}
                                        </p>
                                        <p className="text-gray-600 text-sm">Warmings</p>
                                    </div>
                                </div>
                            )}

                            {/* Operation buttons */}
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <Button
                                    onClick={handleInvalidateUser}
                                    className="justify-start"
                                >
                                    🔄 Invalidate User Data
                                </Button>
                                <Button
                                    onClick={handleWarmDashboard}
                                    className="justify-start"
                                >
                                    🔥 Warm Dashboard Cache
                                </Button>
                                <Button
                                    onClick={handleCleanupCache}
                                    className="justify-start"
                                >
                                    🧹 Cleanup Cache
                                </Button>
                                <Button
                                    onClick={handleInvalidatePatterns}
                                    className="justify-start"
                                >
                                    🎯 Invalidate Patterns
                                </Button>
                                <Button
                                    onClick={handleWarmUserData}
                                    className="justify-start"
                                >
                                    ⚡ Warm User Data
                                </Button>
                                <Button
                                    onClick={isMonitoring ? stopMonitoring : startMonitoring}
                                    variant={isMonitoring ? 'destructive' : 'default'}
                                    className="justify-start"
                                >
                                    {isMonitoring ? '⏹️ Stop Monitoring' : '▶️ Start Monitoring'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Strategy Examples */}
            {activeDemo === 'strategies' && (
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Cache Strategy Examples</CardTitle>
                            <p className="text-gray-600 text-sm">
                                Learn about different cache strategies and their use cases
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                                {/* Smart Invalidation */}
                                <div className="space-y-3">
                                    <h4 className="font-medium text-gray-900">
                                        Smart Invalidation
                                    </h4>
                                    <ul className="space-y-1 text-gray-600 text-sm">
                                        <li>• Entity-based invalidation</li>
                                        <li>• Operation-specific strategies</li>
                                        <li>• Conditional invalidation rules</li>
                                        <li>• Priority-based execution</li>
                                        <li>• Automatic rollback on errors</li>
                                    </ul>
                                    <div className="rounded bg-blue-50 p-3">
                                        <code className="text-blue-800 text-xs">
                                            {`invalidate({
  entity: 'user',
  operation: 'update',
  data: userData
})`}
                                        </code>
                                    </div>
                                </div>

                                {/* Cache Warming */}
                                <div className="space-y-3">
                                    <h4 className="font-medium text-gray-900">Cache Warming</h4>
                                    <ul className="space-y-1 text-gray-600 text-sm">
                                        <li>• Route-based prefetching</li>
                                        <li>• User action prediction</li>
                                        <li>• Background data loading</li>
                                        <li>• Critical query prioritization</li>
                                        <li>• Concurrent warming limits</li>
                                    </ul>
                                    <div className="rounded bg-green-50 p-3">
                                        <code className="text-green-800 text-xs">
                                            {`warmCache({
  route: '/dashboard',
  timestamp: Date.now()
})`}
                                        </code>
                                    </div>
                                </div>

                                {/* Memory Optimization */}
                                <div className="space-y-3">
                                    <h4 className="font-medium text-gray-900">
                                        Memory Optimization
                                    </h4>
                                    <ul className="space-y-1 text-gray-600 text-sm">
                                        <li>• Automatic garbage collection</li>
                                        <li>• Memory pressure monitoring</li>
                                        <li>• Stale query cleanup</li>
                                        <li>• Size-based eviction</li>
                                        <li>• Performance analytics</li>
                                    </ul>
                                    <div className="rounded bg-purple-50 p-3">
                                        <code className="text-purple-800 text-xs">
                                            {`cleanup({
  maxSizeMB: 50,
  autoCleanup: true
})`}
                                        </code>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Integration Examples */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Integration Examples</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <h4 className="mb-2 font-medium text-gray-900">
                                        Entity Operations
                                    </h4>
                                    <div className="rounded bg-gray-50 p-4">
                                        <pre className="text-gray-800 text-sm">
                                            {`// After creating a user
await createUser(userData);
await invalidate({
  entity: 'user',
  operation: 'create',
  data: userData
});

// Before navigating to dashboard
await warmRoute('/dashboard');`}
                                        </pre>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="mb-2 font-medium text-gray-900">
                                        Route-based Warming
                                    </h4>
                                    <div className="rounded bg-gray-50 p-4">
                                        <pre className="text-gray-800 text-sm">
                                            {`// In route component
useEffect(() => {
  warmCache({
    route: router.pathname,
    timestamp: Date.now()
  });
}, [router.pathname]);`}
                                        </pre>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="mb-2 font-medium text-gray-900">
                                        Memory Management
                                    </h4>
                                    <div className="rounded bg-gray-50 p-4">
                                        <pre className="text-gray-800 text-sm">
                                            {`// Automatic cleanup configuration
useAdvancedCache({
  memoryOptimization: {
    maxCacheSizeMB: 100,
    maxQueries: 2000,
    autoCleanup: true,
    gcInterval: 5 * 60 * 1000
  }
});`}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};
