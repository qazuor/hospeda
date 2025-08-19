import { logger } from '@repo/logger';
/**
 * Metrics middleware
 * Collects and tracks API metrics and performance data
 */
import type { Context, MiddlewareHandler } from 'hono';
import { env } from '../utils/env';

/**
 * Configuration for metrics optimization
 */
interface MetricsConfig {
    maxSamplesPerEndpoint: number;
    maxEndpoints: number;
    cleanupIntervalMs: number;
    maxMemoryMB: number;
    enablePercentiles: boolean;
}

/**
 * Default metrics configuration with memory optimization
 */
const DEFAULT_METRICS_CONFIG: MetricsConfig = {
    maxSamplesPerEndpoint: 200, // Increased from 100 for better percentiles
    maxEndpoints: 50, // Limit total endpoints tracked
    cleanupIntervalMs: 5 * 60 * 1000, // Cleanup every 5 minutes
    maxMemoryMB: 10, // Rough memory limit (10MB)
    enablePercentiles: true
};

/**
 * Enhanced metrics store with memory optimization and percentiles
 * In production, this would be replaced with a proper metrics backend
 */
class MetricsStore {
    private requestCounts = new Map<string, number>();
    private responseTimes = new Map<string, number[]>();
    private errorCounts = new Map<string, number>();
    private endpointLastAccess = new Map<string, number>(); // Track last access time
    private activeConnections = 0;
    private totalRequests = 0;
    private totalErrors = 0;
    private config: MetricsConfig;
    private cleanupTimer?: NodeJS.Timeout;

    constructor(config: Partial<MetricsConfig> = {}) {
        this.config = { ...DEFAULT_METRICS_CONFIG, ...config };
        this.startPeriodicCleanup();
    }

    /**
     * Start periodic cleanup to prevent memory leaks
     */
    private startPeriodicCleanup(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        this.cleanupTimer = setInterval(() => {
            this.performCleanup();
        }, this.config.cleanupIntervalMs);
    }

    /**
     * Perform memory cleanup by removing old/unused endpoints
     */
    private performCleanup(): void {
        const now = Date.now();
        const cleanupThreshold = 30 * 60 * 1000; // 30 minutes ago

        // Remove endpoints not accessed recently
        for (const [endpoint, lastAccess] of this.endpointLastAccess.entries()) {
            if (now - lastAccess > cleanupThreshold) {
                this.removeEndpoint(endpoint);
            }
        }

        // If still over limit, remove oldest endpoints
        if (this.requestCounts.size > this.config.maxEndpoints) {
            const sortedByAccess = Array.from(this.endpointLastAccess.entries())
                .sort(([, a], [, b]) => a - b)
                .slice(0, this.requestCounts.size - this.config.maxEndpoints);

            for (const [endpoint] of sortedByAccess) {
                this.removeEndpoint(endpoint);
            }
        }

        logger.debug(`Metrics cleanup completed. Active endpoints: ${this.requestCounts.size}`);
    }

    /**
     * Remove all data for a specific endpoint
     */
    private removeEndpoint(endpoint: string): void {
        this.requestCounts.delete(endpoint);
        this.responseTimes.delete(endpoint);
        this.errorCounts.delete(endpoint);
        this.endpointLastAccess.delete(endpoint);
    }

    /**
     * Calculate percentiles from response times
     */
    private calculatePercentiles(times: number[]): { p95: number; p99: number } {
        if (!this.config.enablePercentiles || times.length === 0) {
            return { p95: 0, p99: 0 };
        }

        const sorted = [...times].sort((a, b) => a - b);
        const p95Index = Math.ceil(sorted.length * 0.95) - 1;
        const p99Index = Math.ceil(sorted.length * 0.99) - 1;

        return {
            p95: sorted[Math.max(0, p95Index)] || 0,
            p99: sorted[Math.max(0, p99Index)] || 0
        };
    }

    /**
     * Update last access time for an endpoint
     */
    private updateLastAccess(endpoint: string): void {
        this.endpointLastAccess.set(endpoint, Date.now());
    }

    /**
     * Increment request count for a specific endpoint
     */
    incrementRequest(endpoint: string): void {
        this.totalRequests++;
        this.updateLastAccess(endpoint);

        const current = this.requestCounts.get(endpoint) || 0;
        this.requestCounts.set(endpoint, current + 1);
    }

    /**
     * Record response time for an endpoint
     */
    recordResponseTime(endpoint: string, timeMs: number): void {
        this.updateLastAccess(endpoint);

        const times = this.responseTimes.get(endpoint) || [];
        times.push(timeMs);

        // Use configurable limit instead of hardcoded 100
        if (times.length > this.config.maxSamplesPerEndpoint) {
            times.shift();
        }

        this.responseTimes.set(endpoint, times);
    }

    /**
     * Increment error count for a specific endpoint
     */
    incrementError(endpoint: string): void {
        this.totalErrors++;
        this.updateLastAccess(endpoint);

        const current = this.errorCounts.get(endpoint) || 0;
        this.errorCounts.set(endpoint, current + 1);
    }

    /**
     * Track active connections
     */
    incrementActiveConnections(): void {
        this.activeConnections++;
    }

    decrementActiveConnections(): void {
        this.activeConnections = Math.max(0, this.activeConnections - 1);
    }

    /**
     * Get metrics summary
     */
    getMetrics() {
        const endpointMetrics = Array.from(this.requestCounts.entries()).map(
            ([endpoint, requests]) => {
                const responseTimes = this.responseTimes.get(endpoint) || [];
                const errors = this.errorCounts.get(endpoint) || 0;
                const avgResponseTime =
                    responseTimes.length > 0
                        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
                        : 0;
                const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
                const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
                const percentiles = this.calculatePercentiles(responseTimes);

                return {
                    endpoint,
                    requests,
                    errors,
                    errorRate: requests > 0 ? (errors / requests) * 100 : 0,
                    avgResponseTime: Math.round(avgResponseTime * 100) / 100,
                    maxResponseTime,
                    minResponseTime,
                    p95ResponseTime: percentiles.p95,
                    p99ResponseTime: percentiles.p99,
                    sampleCount: responseTimes.length
                };
            }
        );

        return {
            summary: {
                totalRequests: this.totalRequests,
                totalErrors: this.totalErrors,
                globalErrorRate:
                    this.totalRequests > 0 ? (this.totalErrors / this.totalRequests) * 100 : 0,
                activeConnections: this.activeConnections,
                timestamp: new Date().toISOString()
            },
            endpoints: endpointMetrics
        };
    }

    /**
     * Reset all metrics (useful for testing)
     */
    reset(): void {
        this.requestCounts.clear();
        this.responseTimes.clear();
        this.errorCounts.clear();
        this.endpointLastAccess.clear();
        this.activeConnections = 0;
        this.totalRequests = 0;
        this.totalErrors = 0;
    }

    /**
     * Get memory usage statistics
     */
    getMemoryStats(): { endpointCount: number; totalSamples: number; estimatedMemoryMB: number } {
        const endpointCount = this.requestCounts.size;
        const totalSamples = Array.from(this.responseTimes.values()).reduce(
            (sum, times) => sum + times.length,
            0
        );

        // Rough estimation: each sample ~8 bytes + overhead
        const estimatedMemoryMB = (totalSamples * 8 + endpointCount * 100) / (1024 * 1024);

        return {
            endpointCount,
            totalSamples,
            estimatedMemoryMB: Math.round(estimatedMemoryMB * 100) / 100
        };
    }

    /**
     * Cleanup and destroy the metrics store
     */
    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
        this.reset();
    }
}

// Global metrics store instance
const metricsStore = new MetricsStore();

/**
 * Extract endpoint identifier from request path
 * Normalizes dynamic routes (e.g., /users/123 -> /users/:id)
 */
function getEndpointKey(path: string, method: string): string {
    // Normalize dynamic IDs to parameter placeholders
    // Process more specific patterns first to avoid conflicts
    const normalizedPath = path
        .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, '/:uuid')
        .replace(/\/[a-f0-9]{24}/g, '/:objectId')
        .replace(/\/\d+/g, '/:id');

    return `${method} ${normalizedPath}`;
}

/**
 * Check if response indicates an error
 */
function isErrorResponse(status: number): boolean {
    return status >= 400;
}

/**
 * Metrics middleware that tracks request metrics
 * @returns Hono middleware handler
 */
export const createMetricsMiddleware = (): MiddlewareHandler => {
    return async (c: Context, next) => {
        const startTime = Date.now();
        const method = c.req.method;
        const path = c.req.path;
        const endpoint = getEndpointKey(path, method);

        // Track request start
        metricsStore.incrementRequest(endpoint);
        metricsStore.incrementActiveConnections();

        try {
            await next();
        } catch (error) {
            // Track errors that bubble up
            metricsStore.incrementError(endpoint);
            throw error;
        } finally {
            // Always track response time and decrement active connections
            const responseTime = Date.now() - startTime;
            metricsStore.recordResponseTime(endpoint, responseTime);
            metricsStore.decrementActiveConnections();

            // Track errors based on response status
            if (c.res && isErrorResponse(c.res.status)) {
                metricsStore.incrementError(endpoint);
            }

            // Log metrics for monitoring (can be disabled in production)
            // Use different thresholds for auth endpoints vs regular endpoints
            const isAuthEndpoint = endpoint.includes('/auth/');
            const threshold = isAuthEndpoint
                ? env.METRICS_SLOW_AUTH_THRESHOLD_MS
                : env.METRICS_SLOW_REQUEST_THRESHOLD_MS;

            if (responseTime > threshold) {
                // Log slow requests with context about threshold used
                logger.warn(
                    {
                        endpoint,
                        responseTime,
                        threshold,
                        isAuthEndpoint,
                        status: c.res?.status
                    },
                    'Slow request detected'
                );
            }
        }
    };
};

/**
 * Get current metrics data
 * Useful for health checks and monitoring endpoints
 */
export const getMetrics = () => {
    return metricsStore.getMetrics();
};

/**
 * Get filtered metrics by endpoint category
 */
export const getFilteredMetrics = (filter: (endpoint: string) => boolean) => {
    const allMetrics = metricsStore.getMetrics();

    const filteredEndpoints = allMetrics.endpoints.filter((metric) => filter(metric.endpoint));

    // Recalculate summary for filtered endpoints
    const filteredRequests = filteredEndpoints.reduce((sum, ep) => sum + ep.requests, 0);
    const filteredErrors = filteredEndpoints.reduce((sum, ep) => sum + ep.errors, 0);

    return {
        summary: {
            totalRequests: filteredRequests,
            totalErrors: filteredErrors,
            globalErrorRate: filteredRequests > 0 ? (filteredErrors / filteredRequests) * 100 : 0,
            activeConnections: allMetrics.summary.activeConnections,
            timestamp: allMetrics.summary.timestamp
        },
        endpoints: filteredEndpoints
    };
};

/**
 * Get metrics for API endpoints (public/admin routes)
 */
export const getApiMetrics = () => {
    return getFilteredMetrics((endpoint) => {
        const path = endpoint.toLowerCase();
        return (
            path.includes('user') ||
            path.includes('accommodation') ||
            path.includes('destination') ||
            path.includes('event') ||
            path.includes('attraction') ||
            path.includes('amenity') ||
            path.includes('tag') ||
            path.includes('feature') ||
            path.includes('post') ||
            path.includes('auth/login') ||
            path.includes('auth/logout') ||
            path.includes('admin')
        );
    });
};

/**
 * Get metrics for system endpoints (health, docs, metrics)
 */
export const getSystemMetrics = () => {
    return getFilteredMetrics((endpoint) => {
        const path = endpoint.toLowerCase();
        return (
            path.includes('health') ||
            path.includes('docs') ||
            path.includes('metrics') ||
            path.includes('openapi') ||
            endpoint === 'GET /'
        );
    });
};

/**
 * Reset metrics store
 * Useful for testing and development
 */
export const resetMetrics = () => {
    metricsStore.reset();
};

/**
 * Get metrics in Prometheus format
 * Basic implementation for Prometheus compatibility
 */
export const getPrometheusMetrics = (): string => {
    const metrics = metricsStore.getMetrics();
    const lines: string[] = [];

    // Add help and type information
    lines.push('# HELP http_requests_total Total number of HTTP requests');
    lines.push('# TYPE http_requests_total counter');

    lines.push('# HELP http_request_duration_seconds HTTP request duration in seconds');
    lines.push('# TYPE http_request_duration_seconds histogram');

    lines.push('# HELP http_request_duration_p95_seconds 95th percentile response time');
    lines.push('# TYPE http_request_duration_p95_seconds gauge');

    lines.push('# HELP http_request_duration_p99_seconds 99th percentile response time');
    lines.push('# TYPE http_request_duration_p99_seconds gauge');

    lines.push('# HELP http_errors_total Total number of HTTP errors');
    lines.push('# TYPE http_errors_total counter');

    // Add endpoint metrics
    for (const endpoint of metrics.endpoints) {
        const labels = `{endpoint="${endpoint.endpoint}"}`;
        lines.push(`http_requests_total${labels} ${endpoint.requests}`);
        lines.push(`http_errors_total${labels} ${endpoint.errors}`);
        lines.push(
            `http_request_duration_seconds_sum${labels} ${(endpoint.avgResponseTime * endpoint.requests) / 1000}`
        );
        lines.push(`http_request_duration_seconds_count${labels} ${endpoint.requests}`);
        lines.push(`http_request_duration_p95_seconds${labels} ${endpoint.p95ResponseTime / 1000}`);
        lines.push(`http_request_duration_p99_seconds${labels} ${endpoint.p99ResponseTime / 1000}`);
    }

    // Add global metrics
    lines.push(`http_requests_total_global ${metrics.summary.totalRequests}`);
    lines.push(`http_errors_total_global ${metrics.summary.totalErrors}`);
    lines.push(`http_active_connections ${metrics.summary.activeConnections}`);

    return `${lines.join('\n')}\n`;
};

/**
 * Get memory usage statistics
 */
export const getMemoryStats = () => {
    return metricsStore.getMemoryStats();
};

/**
 * Get detailed metrics with percentiles
 */
export const getDetailedMetrics = () => {
    const metrics = metricsStore.getMetrics();
    const memoryStats = metricsStore.getMemoryStats();

    return {
        ...metrics,
        performance: {
            memoryUsage: memoryStats,
            optimization: {
                endpointLimit: DEFAULT_METRICS_CONFIG.maxEndpoints,
                samplesPerEndpoint: DEFAULT_METRICS_CONFIG.maxSamplesPerEndpoint,
                cleanupInterval: DEFAULT_METRICS_CONFIG.cleanupIntervalMs / 1000 / 60, // minutes
                percentilesEnabled: DEFAULT_METRICS_CONFIG.enablePercentiles
            }
        }
    };
};

/**
 * Configure metrics optimization (for advanced usage)
 */
export const configureMetrics = (config: Partial<MetricsConfig>) => {
    // Note: This would require recreating the store with new config
    // For now, we log the configuration change
    logger.info({ config }, 'Metrics configuration update requested (requires restart)');
    return { success: false, reason: 'Configuration changes require application restart' };
};

/**
 * Default metrics middleware instance
 */
export const metricsMiddleware = createMetricsMiddleware();
