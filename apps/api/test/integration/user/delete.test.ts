/**
 * Tests for user delete route with mocked UserService
 * Tests the user delete endpoint with service mocking
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';

// Mock the UserService
vi.mock('@repo/service-core', () => {
    const mockSoftDelete = vi.fn();

    return {
        UserService: vi.fn().mockImplementation(() => ({
            softDelete: mockSoftDelete
        }))
    };
});

// Get the mocked function after the mock is set up
const { UserService } = await import('@repo/service-core');
const mockSoftDelete = (UserService as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value
    ?.softDelete;

describe('User Delete Route (With Service Mocking)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('DELETE /api/v1/public/users/{id}', () => {
        it('should return success response when user is deleted', async () => {
            // Mock successful response
            mockSoftDelete.mockResolvedValue({
                data: {
                    count: 1
                },
                error: null
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
                method: 'DELETE',
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.success).toBe(true);
            expect(data.data).toBeDefined();
            expect(data.data.deleted).toBe(true);
            expect(data.data.id).toBe('user-123');

            // Check metadata
            expect(data.metadata).toBeDefined();
            expect(data.metadata.timestamp).toBeDefined();
            expect(data.metadata.requestId).toBeDefined();

            // Verify service was called correctly
            expect(mockSoftDelete).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'guest',
                    role: 'GUEST'
                }),
                'user-123'
            );
        });

        it('should handle user not found', async () => {
            // Mock not found response
            mockSoftDelete.mockResolvedValue({
                data: {
                    count: 0
                },
                error: null
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users/non-existent', {
                method: 'DELETE',
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.success).toBe(true);
            expect(data.data.deleted).toBe(false);
            expect(data.data.id).toBe('non-existent');
        });

        it('should handle service errors gracefully', async () => {
            // Mock error response
            mockSoftDelete.mockResolvedValue({
                data: null,
                error: {
                    code: 'PERMISSION_DENIED',
                    message: 'User does not have permission to delete this user'
                }
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
                method: 'DELETE',
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(500);
            const data = await res.json();

            expect(data.success).toBe(false);
            expect(data.error).toMatchObject({
                code: expect.stringMatching(/INTERNAL_ERROR|PERMISSION_DENIED/),
                message: expect.any(String)
            });
        });

        it('should handle service throwing exception', async () => {
            mockSoftDelete.mockRejectedValue(new Error('Database connection failed'));

            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
                method: 'DELETE',
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(500);
            const data = await res.json();

            expect(data.success).toBe(false);
        });
    });

    describe('Validation', () => {
        it('should reject requests without user-agent', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
                method: 'DELETE',
                headers: {
                    // Missing user-agent
                }
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('MISSING_REQUIRED_HEADER');
        });

        it('should validate user ID parameter', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users/ab', {
                method: 'DELETE',
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
        });

        it('should accept requests with valid Accept header', async () => {
            mockSoftDelete.mockResolvedValue({
                data: {
                    count: 1
                },
                error: null
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
                method: 'DELETE',
                headers: {
                    'user-agent': 'test-agent',
                    accept: 'application/json'
                }
            });

            expect(res.status).toBe(200);
        });
    });

    describe('Service Integration', () => {
        it('should pass correct actor to service', async () => {
            mockSoftDelete.mockResolvedValue({
                data: {
                    count: 1
                },
                error: null
            });

            const app = initApp();

            await app.request('/api/v1/public/users/user-123', {
                method: 'DELETE',
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(mockSoftDelete).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'guest',
                    role: 'GUEST',
                    permissions: expect.arrayContaining(['access.apiPublic'])
                }),
                'user-123'
            );
        });

        it('should handle different user IDs', async () => {
            mockSoftDelete.mockResolvedValue({
                data: {
                    count: 1
                },
                error: null
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-456', {
                method: 'DELETE',
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.data.id).toBe('user-456');
            expect(data.data.deleted).toBe(true);

            expect(mockSoftDelete).toHaveBeenCalledWith(expect.any(Object), 'user-456');
        });

        it('should handle multiple delete attempts', async () => {
            // First attempt - successful
            mockSoftDelete.mockResolvedValueOnce({
                data: {
                    count: 1
                },
                error: null
            });

            // Second attempt - user already deleted
            mockSoftDelete.mockResolvedValueOnce({
                data: {
                    count: 0
                },
                error: null
            });

            const app = initApp();

            // First delete
            const res1 = await app.request('/api/v1/public/users/user-123', {
                method: 'DELETE',
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res1.status).toBe(200);
            const data1 = await res1.json();
            expect(data1.data.deleted).toBe(true);

            // Second delete
            const res2 = await app.request('/api/v1/public/users/user-123', {
                method: 'DELETE',
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res2.status).toBe(200);
            const data2 = await res2.json();
            expect(data2.data.deleted).toBe(false);

            expect(mockSoftDelete).toHaveBeenCalledTimes(2);
        });
    });
});
