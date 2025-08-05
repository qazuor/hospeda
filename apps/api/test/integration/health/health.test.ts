/**
 * Tests for all health routes (migrated)
 * Tests the refactored health routes with new validation system
 */

import { describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Health Routes (Migrated)', () => {
    describe('GET /health/live', () => {
        it('should return success response with correct format', async () => {
            const app = initApp();

            const res = await app.request('/health/live', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.success).toBe(true);
            expect(data.data.alive).toBe(true);
            expect(data.data.timestamp).toBeDefined();
            expect(data.metadata.timestamp).toBeDefined();
            expect(data.metadata.requestId).toBeDefined();
        });
    });

    describe('GET /health/ready', () => {
        it('should return success response with correct format', async () => {
            const app = initApp();

            const res = await app.request('/health/ready', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.success).toBe(true);
            expect(data.data.ready).toBe(true);
            expect(data.data.timestamp).toBeDefined();
            expect(data.metadata.timestamp).toBeDefined();
            expect(data.metadata.requestId).toBeDefined();
        });
    });

    describe('GET /health', () => {
        it('should return success response with health status', async () => {
            const app = initApp();

            const res = await app.request('/health', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.success).toBe(true);
            expect(data.data.status).toBe('healthy');
            expect(data.data.timestamp).toBeDefined();
            expect(data.data.uptime).toBeDefined();
            expect(data.data.version).toBeDefined();
            expect(data.data.environment).toBeDefined();
            expect(data.metadata.timestamp).toBeDefined();
            expect(data.metadata.requestId).toBeDefined();
        });
    });

    describe('GET /health/db', () => {
        it('should return database status (handles both connected and disconnected)', async () => {
            const app = initApp();

            const res = await app.request('/health/db', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            // In test environment, database might not be available
            // So we accept both 200 (connected) and 503 (disconnected)
            expect([200, 503]).toContain(res.status);

            const data = await res.json();

            expect(data.success).toBe(true);
            expect(data.data.status).toBeDefined();
            expect(['up', 'down']).toContain(data.data.status);
            expect(data.data.database.status).toBeDefined();
            expect(['connected', 'disconnected']).toContain(data.data.database.status);
            expect(data.data.database.responseTime).toBeDefined();
            expect(data.data.timestamp).toBeDefined();
            expect(data.data.uptime).toBeDefined();
            expect(data.data.version).toBeDefined();
            expect(data.data.environment).toBeDefined();
            expect(data.metadata.timestamp).toBeDefined();
            expect(data.metadata.requestId).toBeDefined();

            // If database is down, should have error message
            if (data.data.status === 'down') {
                expect(data.data.database.error).toBeDefined();
            }
        });

        it('should include request ID in metadata', async () => {
            const app = initApp();

            const res = await app.request('/health/db', {
                headers: {
                    'user-agent': 'test-agent',
                    'x-request-id': 'test-request-456'
                }
            });

            // Accept both 200 and 503 status codes
            expect([200, 503]).toContain(res.status);

            const data = await res.json();
            expect(data.metadata.requestId).toBe('test-request-456');
        });
    });

    describe('Validation', () => {
        it('should reject requests without user-agent for all health endpoints', async () => {
            const app = initApp();
            const endpoints = ['/health/live', '/health/ready', '/health', '/health/db'];

            for (const endpoint of endpoints) {
                const res = await app.request(endpoint, {
                    headers: {
                        // Missing user-agent
                    }
                });

                expect(res.status).toBe(400);
                const data = await res.json();
                expect(data.success).toBe(false);
                expect(data.error.code).toBe('MISSING_REQUIRED_HEADER');
            }
        });

        it('should accept requests with valid Accept header for all health endpoints', async () => {
            const app = initApp();
            const endpoints = ['/health/live', '/health/ready', '/health', '/health/db'];

            for (const endpoint of endpoints) {
                const res = await app.request(endpoint, {
                    headers: {
                        'user-agent': 'test-agent',
                        accept: 'application/json'
                    }
                });

                // For /health/db, accept both 200 and 503
                if (endpoint === '/health/db') {
                    expect([200, 503]).toContain(res.status);
                } else {
                    expect(res.status).toBe(200);
                }
            }
        });

        it('should accept requests with wildcard Accept header for all health endpoints', async () => {
            const app = initApp();
            const endpoints = ['/health/live', '/health/ready', '/health', '/health/db'];

            for (const endpoint of endpoints) {
                const res = await app.request(endpoint, {
                    headers: {
                        'user-agent': 'test-agent',
                        accept: '*/*'
                    }
                });

                // For /health/db, accept both 200 and 503
                if (endpoint === '/health/db') {
                    expect([200, 503]).toContain(res.status);
                } else {
                    expect(res.status).toBe(200);
                }
            }
        });
    });
});
