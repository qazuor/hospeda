/**
 * Health Check Route Tests
 * Tests the /health endpoint that bypasses the middleware chain
 */
import { describe, expect, it, vi } from 'vitest';

// Mock all middlewares to isolate health check testing
vi.mock('../../src/middlewares/actor', () => ({
    actorMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/auth', () => ({
    authMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/cache', () => ({
    cacheMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/compression', () => ({
    compressionMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/cors', () => ({
    corsMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/response', () => ({
    responseFormattingMiddleware: vi.fn(() => vi.fn()),
    createErrorHandler: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/logger', () => ({
    loggerMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/metrics', () => ({
    metricsMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/rate-limit', () => ({
    rateLimitMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/security', () => ({
    originVerificationMiddleware: vi.fn(() => vi.fn()),
    securityHeadersMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/sentry', () => ({
    sentryMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/validation', () => ({
    validationMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/response-validator', () => ({
    responseValidatorMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/billing', () => ({
    billingMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/billing-customer', () => ({
    billingCustomerMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    entitlementMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/trial', () => ({
    trialMiddleware: vi.fn(() => vi.fn())
}));

import { createApp } from '../../src/utils/create-app';

describe('Health Check Route', () => {
    it('should return 200 with status ok', async () => {
        const app = createApp();
        const res = await app.request('/health');

        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.status).toBe('ok');
    });

    it('should return a valid ISO timestamp', async () => {
        const app = createApp();
        const res = await app.request('/health');
        const body = await res.json();

        expect(body.timestamp).toBeDefined();
        // Validate it is a valid ISO 8601 date string
        const parsed = new Date(body.timestamp);
        expect(parsed.toISOString()).toBe(body.timestamp);
    });

    it('should return Content-Type application/json', async () => {
        const app = createApp();
        const res = await app.request('/health');
        const contentType = res.headers.get('Content-Type');

        expect(contentType).toContain('application/json');
    });

    it('should respond quickly without middleware overhead', async () => {
        const app = createApp();
        const start = Date.now();
        await app.request('/health');
        const elapsed = Date.now() - start;

        // Health check should respond in under 100ms (generous limit)
        expect(elapsed).toBeLessThan(100);
    });
});
