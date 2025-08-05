import { logger } from '@repo/logger';
/**
 * Metrics middleware
 * Collects and tracks API metrics and performance data
 */
import type { Context, MiddlewareHandler } from 'hono';

/**
 * Metrics store for in-memory tracking
 * In production, this would be replaced with a proper metrics backend
 */
class MetricsStore {
    private requestCounts = new Map<string, number>();
    private responseTimes = new Map<string, number[]>();
    private errorCounts = new Map<string, number>();
    private activeConnections = 0;
    private totalRequests = 0;
    private totalErrors = 0;

    /**
     * Increment request count for a specific endpoint
     */
    incrementRequest(endpoint: string): void {
        this.totalRequests++;
        const current = this.requestCounts.get(endpoint) || 0;
        this.requestCounts.set(endpoint, current + 1);
    }

    /**
     * Record response time for an endpoint
     */
    recordResponseTime(endpoint: string, timeMs: number): void {
        const times = this.responseTimes.get(endpoint) || [];
        times.push(timeMs);
        // Keep only last 100 measurements to prevent memory bloat
        if (times.length > 100) {
            times.shift();
        }
        this.responseTimes.set(endpoint, times);
    }

    /**
     * Increment error count for a specific endpoint
     */
    incrementError(endpoint: string): void {
        this.totalErrors++;
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

                return {
                    endpoint,
                    requests,
                    errors,
                    errorRate: requests > 0 ? (errors / requests) * 100 : 0,
                    avgResponseTime: Math.round(avgResponseTime * 100) / 100,
                    maxResponseTime,
                    minResponseTime
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
        this.activeConnections = 0;
        this.totalRequests = 0;
        this.totalErrors = 0;
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
            if (responseTime > 1000) {
                // Log slow requests
                logger.warn(
                    {
                        endpoint,
                        responseTime,
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
    }

    // Add global metrics
    lines.push(`http_requests_total_global ${metrics.summary.totalRequests}`);
    lines.push(`http_errors_total_global ${metrics.summary.totalErrors}`);
    lines.push(`http_active_connections ${metrics.summary.activeConnections}`);

    return `${lines.join('\n')}\n`;
};

/**
 * Default metrics middleware instance
 */
export const metricsMiddleware = createMetricsMiddleware();
