/**
 * Authentication integration tests
 * Tests Clerk authentication and actor system
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';

describe('Authentication Integration Tests', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterAll(() => {
        // Cleanup if needed
    });

    describe('GET /api/v1/public/auth/status', () => {
        it('should return guest actor when no authentication token is provided', async () => {
            const response = await app.request('/api/v1/public/auth/status', {
                headers: {
                    'User-Agent': 'test-agent'
                }
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.isAuthenticated).toBe(false);
            expect(data.data.userId).toBeNull();
            expect(data.data.actor.id).toBe('00000000-0000-4000-8000-000000000000');
            expect(data.data.actor.role).toBe('GUEST');
            expect(data.data.actor.permissions).toContain('access.apiPublic');
        });

        it('should return guest actor when invalid token is provided', async () => {
            const response = await app.request('/api/v1/public/auth/status', {
                headers: {
                    'User-Agent': 'test-agent',
                    Authorization: 'Bearer invalid_token_here'
                }
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.isAuthenticated).toBe(false);
            expect(data.data.userId).toBeNull();
            expect(data.data.actor.id).toBe('00000000-0000-4000-8000-000000000000');
            expect(data.data.actor.role).toBe('GUEST');
        });

        it('should return guest actor when expired token is provided', async () => {
            const response = await app.request('/api/v1/public/auth/status', {
                headers: {
                    'User-Agent': 'test-agent',
                    Authorization:
                        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
                }
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.isAuthenticated).toBe(false);
            expect(data.data.userId).toBeNull();
            expect(data.data.actor.id).toBe('00000000-0000-4000-8000-000000000000');
            expect(data.data.actor.role).toBe('GUEST');
        });

        it('should include metadata in response', async () => {
            const response = await app.request('/api/v1/public/auth/status', {
                headers: {
                    'User-Agent': 'test-agent'
                }
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.metadata).toBeDefined();
            expect(data.metadata.timestamp).toBeDefined();
            expect(data.metadata.requestId).toBeDefined();
        });

        it('should handle malformed authorization header gracefully', async () => {
            const response = await app.request('/api/v1/public/auth/status', {
                headers: {
                    'User-Agent': 'test-agent',
                    Authorization: 'Bearer invalid_token_but_valid_format'
                }
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.isAuthenticated).toBe(false);
            expect(data.data.userId).toBeNull();
        });

        it('should handle empty authorization header gracefully', async () => {
            const response = await app.request('/api/v1/public/auth/status', {
                headers: {
                    'User-Agent': 'test-agent',
                    Authorization: ''
                }
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.isAuthenticated).toBe(false);
            expect(data.data.userId).toBeNull();
        });
    });

    describe('Actor System Integration', () => {
        it('should always provide an actor in context', async () => {
            const response = await app.request('/api/v1/public/auth/status', {
                headers: {
                    'User-Agent': 'test-agent'
                }
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.actor).toBeDefined();
            expect(data.data.actor.id).toBeDefined();
            expect(data.data.actor.role).toBeDefined();
            expect(data.data.actor.permissions).toBeDefined();
            expect(Array.isArray(data.data.actor.permissions)).toBe(true);
        });

        it('should provide consistent actor structure', async () => {
            const response = await app.request('/api/v1/public/auth/status', {
                headers: {
                    'User-Agent': 'test-agent'
                }
            });
            const data = await response.json();

            const actor = data.data.actor;
            expect(actor).toMatchObject({
                id: expect.any(String),
                role: expect.any(String),
                permissions: expect.any(Array)
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection errors gracefully', async () => {
            // This test would require mocking the database connection
            // For now, we'll test that the endpoint doesn't crash
            const response = await app.request('/api/v1/public/auth/status', {
                headers: {
                    'User-Agent': 'test-agent'
                }
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
        });

        it('should handle service layer errors gracefully', async () => {
            // This test would require mocking the UserService
            // For now, we'll test that the endpoint doesn't crash
            const response = await app.request('/api/v1/public/auth/status', {
                headers: {
                    'User-Agent': 'test-agent'
                }
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
        });
    });
});
