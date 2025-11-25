import type { Actor } from '@repo/service-core';

/**
 * Performance measurement utilities for E2E tests
 */

/**
 * Creates authenticated headers for performance tests
 */
function createPerfAuthHeaders(actor: Actor): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest-perf',
        accept: 'application/json',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions)
    };
}

export interface PerformanceMetrics {
    /** Total time in milliseconds */
    duration: number;
    /** HTTP status code */
    status: number;
    /** Response size in bytes (if available) */
    responseSize?: number;
}

export interface AggregatedMetrics {
    /** Number of requests */
    count: number;
    /** Minimum response time */
    min: number;
    /** Maximum response time */
    max: number;
    /** Average response time */
    avg: number;
    /** 95th percentile response time */
    p95: number;
    /** 99th percentile response time */
    p99: number;
    /** Requests per second */
    rps: number;
    /** Success rate (percentage) */
    successRate: number;
}

/**
 * Measure the performance of a single request
 */
export async function measureRequest(
    app: any,
    method: string,
    path: string,
    actor: Actor,
    body?: any
): Promise<PerformanceMetrics> {
    const headers = createPerfAuthHeaders(actor);

    const start = performance.now();

    const response = await app.request(path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const end = performance.now();
    const duration = end - start;

    // Try to get response size
    let responseSize: number | undefined;
    try {
        const text = await response.clone().text();
        responseSize = new TextEncoder().encode(text).length;
    } catch {
        // Ignore if we can't get size
    }

    return {
        duration,
        status: response.status,
        responseSize
    };
}

/**
 * Measure the performance of a single request without authentication
 * Used for public endpoints like health checks
 */
export async function measurePublicRequest(
    app: any,
    method: string,
    path: string,
    body?: any
): Promise<PerformanceMetrics> {
    const headers: Record<string, string> = {
        'content-type': 'application/json',
        'user-agent': 'vitest-perf',
        accept: 'application/json'
    };

    const start = performance.now();

    const response = await app.request(path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const end = performance.now();
    const duration = end - start;

    // Try to get response size
    let responseSize: number | undefined;
    try {
        const text = await response.clone().text();
        responseSize = new TextEncoder().encode(text).length;
    } catch {
        // Ignore if we can't get size
    }

    return {
        duration,
        status: response.status,
        responseSize
    };
}

/**
 * Run multiple requests concurrently and measure performance
 */
export async function measureConcurrent(
    app: any,
    method: string,
    path: string,
    actor: Actor,
    concurrency: number,
    body?: any
): Promise<PerformanceMetrics[]> {
    const promises: Promise<PerformanceMetrics>[] = [];

    for (let i = 0; i < concurrency; i++) {
        promises.push(measureRequest(app, method, path, actor, body));
    }

    return Promise.all(promises);
}

/**
 * Run multiple public requests concurrently (no auth required)
 */
export async function measurePublicConcurrent(
    app: any,
    method: string,
    path: string,
    concurrency: number,
    body?: any
): Promise<PerformanceMetrics[]> {
    const promises: Promise<PerformanceMetrics>[] = [];

    for (let i = 0; i < concurrency; i++) {
        promises.push(measurePublicRequest(app, method, path, body));
    }

    return Promise.all(promises);
}

/**
 * Run a load test for public endpoints (no auth required)
 */
export async function runPublicLoadTest(
    app: any,
    method: string,
    path: string,
    totalRequests: number,
    concurrency: number,
    body?: any
): Promise<PerformanceMetrics[]> {
    const results: PerformanceMetrics[] = [];
    const batches = Math.ceil(totalRequests / concurrency);

    for (let i = 0; i < batches; i++) {
        const batchSize = Math.min(concurrency, totalRequests - i * concurrency);
        const batchResults = await measurePublicConcurrent(app, method, path, batchSize, body);
        results.push(...batchResults);
    }

    return results;
}

/**
 * Run a load test with specified requests over time
 */
export async function runLoadTest(
    app: any,
    method: string,
    path: string,
    actor: Actor,
    totalRequests: number,
    concurrency: number,
    body?: any
): Promise<PerformanceMetrics[]> {
    const results: PerformanceMetrics[] = [];
    const batches = Math.ceil(totalRequests / concurrency);

    for (let i = 0; i < batches; i++) {
        const batchSize = Math.min(concurrency, totalRequests - i * concurrency);
        const batchResults = await measureConcurrent(app, method, path, actor, batchSize, body);
        results.push(...batchResults);
    }

    return results;
}

/**
 * Calculate aggregated metrics from individual measurements
 */
export function calculateMetrics(measurements: PerformanceMetrics[]): AggregatedMetrics {
    if (measurements.length === 0) {
        return {
            count: 0,
            min: 0,
            max: 0,
            avg: 0,
            p95: 0,
            p99: 0,
            rps: 0,
            successRate: 0
        };
    }

    const durations = measurements.map((m) => m.duration).sort((a, b) => a - b);
    const successCount = measurements.filter((m) => m.status >= 200 && m.status < 400).length;

    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;

    // Calculate percentiles
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    // Calculate RPS (requests per second)
    const totalTime = sum / 1000; // Convert to seconds
    const rps = totalTime > 0 ? measurements.length / totalTime : 0;

    return {
        count: measurements.length,
        min: durations[0] ?? 0,
        max: durations[durations.length - 1] ?? 0,
        avg,
        p95: durations[p95Index] ?? durations[durations.length - 1] ?? 0,
        p99: durations[p99Index] ?? durations[durations.length - 1] ?? 0,
        rps,
        successRate: (successCount / measurements.length) * 100
    };
}

/**
 * Format metrics for display
 */
export function formatMetrics(metrics: AggregatedMetrics, label: string): string {
    return `
${label}:
  Count:        ${metrics.count} requests
  Min:          ${metrics.min.toFixed(2)}ms
  Max:          ${metrics.max.toFixed(2)}ms
  Avg:          ${metrics.avg.toFixed(2)}ms
  P95:          ${metrics.p95.toFixed(2)}ms
  P99:          ${metrics.p99.toFixed(2)}ms
  Success Rate: ${metrics.successRate.toFixed(1)}%
`;
}

/**
 * Performance thresholds for assertions
 */
export const PERFORMANCE_THRESHOLDS = {
    /** Maximum average response time for simple GET requests */
    SIMPLE_GET_AVG: 100,
    /** Maximum average response time for list/paginated requests */
    LIST_AVG: 200,
    /** Maximum average response time for complex queries */
    COMPLEX_QUERY_AVG: 300,
    /** Maximum average response time for write operations */
    WRITE_AVG: 200,
    /** Maximum P95 response time multiplier (P95 should be at most 4x avg for small samples) */
    P95_MULTIPLIER: 4,
    /** Minimum success rate */
    MIN_SUCCESS_RATE: 99,
    /** Maximum response time for any single request */
    MAX_SINGLE_REQUEST: 1000
};
