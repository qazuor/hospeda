/**
 * Integration tests for the API app
 * Tests the complete request flow with middleware
 */

import { describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';

describe('API Integration Tests', () => {
    it('should handle health check endpoint', async () => {
        const app = initApp();

        const res = await app.request('/health/live', {
            headers: {
                'user-agent': 'test-agent'
            }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.data.alive).toBe(true);
    });

    it('should handle root endpoint', async () => {
        const app = initApp();

        const res = await app.request('/', {
            headers: {
                'user-agent': 'test-agent'
            }
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.name).toBe('hospeda-api');
        expect(data.data.status).toBe('operational');
        expect(data.data.version).toBe('0.0.1');
        expect(data.data.description).toBe(
            'Complete API for the Hospeda tourism accommodation platform'
        );
        expect(data.data.documentation).toBe('/docs');
        expect(data.metadata).toBeDefined();
        expect(data.metadata.timestamp).toBeDefined();
        expect(data.metadata.requestId).toBeDefined();
    });

    it('should reject requests without user-agent', async () => {
        const app = initApp();

        const res = await app.request('/health/live', {
            headers: {
                // Missing user-agent
            }
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('MISSING_REQUIRED_HEADER');
    });

    it('should accept requests with valid Accept header', async () => {
        const app = initApp();

        const res = await app.request('/health/live', {
            headers: {
                'user-agent': 'test-agent',
                accept: 'application/json'
            }
        });

        expect(res.status).toBe(200);
    });

    it('should accept requests with wildcard Accept header', async () => {
        const app = initApp();

        const res = await app.request('/health/live', {
            headers: {
                'user-agent': 'test-agent',
                accept: '*/*'
            }
        });

        expect(res.status).toBe(200);
    });

    it('should reject requests with invalid Accept header', async () => {
        const app = initApp();

        const res = await app.request('/health/live', {
            headers: {
                'user-agent': 'test-agent',
                accept: 'text/html'
            }
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('INVALID_ACCEPT_HEADER');
    });
});
