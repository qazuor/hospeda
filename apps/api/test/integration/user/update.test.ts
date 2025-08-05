/**
 * Tests for user update route with mocked UserService
 * Tests the user update endpoint with service mocking
 */

import { LifecycleStatusEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';

// Mock the UserService
vi.mock('@repo/service-core', () => {
    const mockUpdate = vi.fn();

    return {
        UserService: vi.fn().mockImplementation(() => ({
            update: mockUpdate
        }))
    };
});

// Get the mocked function after the mock is set up
const { UserService } = await import('@repo/service-core');
const mockUpdate = (UserService as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value
    ?.update;

describe('User Update Route (With Service Mocking)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('PUT /api/v1/public/users/{id}', () => {
        it('should return success response with updated user', async () => {
            // Mock successful response
            mockUpdate.mockResolvedValue({
                data: {
                    id: 'user-123',
                    firstName: 'John',
                    lastName: 'Smith',
                    displayName: 'John Smith',
                    role: RoleEnum.ADMIN,
                    permissions: [],
                    slug: 'john-smith',
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    visibility: VisibilityEnum.PUBLIC,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                error: null
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
                method: 'PUT',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    lastName: 'Smith',
                    displayName: 'John Smith',
                    role: RoleEnum.ADMIN
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.success).toBe(true);
            expect(data.data).toBeDefined();
            expect(data.data.id).toBe('user-123');
            expect(data.data.firstName).toBe('John');
            expect(data.data.lastName).toBe('Smith');
            expect(data.data.displayName).toBe('John Smith');
            expect(data.data.role).toBe(RoleEnum.ADMIN);

            // Check metadata
            expect(data.metadata).toBeDefined();
            expect(data.metadata.timestamp).toBeDefined();
            expect(data.metadata.requestId).toBeDefined();

            // Verify service was called correctly
            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'guest',
                    role: 'GUEST'
                }),
                'user-123',
                {
                    id: 'user-123',
                    lastName: 'Smith',
                    displayName: 'John Smith',
                    role: RoleEnum.ADMIN
                }
            );
        });

        it('should handle partial updates', async () => {
            mockUpdate.mockResolvedValue({
                data: {
                    id: 'user-123',
                    firstName: 'John',
                    lastName: 'Doe',
                    displayName: 'John Doe Updated',
                    role: RoleEnum.USER
                },
                error: null
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
                method: 'PUT',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    displayName: 'John Doe Updated'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.data.displayName).toBe('John Doe Updated');
        });

        it('should handle service errors gracefully', async () => {
            // Mock error response
            mockUpdate.mockResolvedValue({
                data: null,
                error: {
                    code: 'PERMISSION_DENIED',
                    message: 'User does not have permission to update this user'
                }
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
                method: 'PUT',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    displayName: 'Updated Name'
                })
            });

            expect(res.status).toBe(500);
            const data = await res.json();

            expect(data.success).toBe(false);
            expect(data.error).toMatchObject({
                code: expect.stringMatching(/INTERNAL_ERROR|PERMISSION_DENIED/),
                message: expect.any(String)
            });
        });

        it('should handle user not found', async () => {
            mockUpdate.mockResolvedValue({
                data: null,
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                }
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users/non-existent', {
                method: 'PUT',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    displayName: 'Updated Name'
                })
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
                method: 'PUT',
                headers: {
                    'content-type': 'application/json'
                    // Missing user-agent
                },
                body: JSON.stringify({
                    displayName: 'Updated Name'
                })
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('MISSING_REQUIRED_HEADER');
        });

        it('should validate user ID parameter', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users/ab', {
                method: 'PUT',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    displayName: 'Updated Name'
                })
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
        });

        it('should validate field lengths', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
                method: 'PUT',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    firstName: 'J', // Too short
                    lastName: 'D' // Too short
                })
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
        });

        it('should handle invalid role enum', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
                method: 'PUT',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    role: 'INVALID_ROLE'
                })
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
        });
    });

    describe('Service Integration', () => {
        it('should pass correct actor to service', async () => {
            mockUpdate.mockResolvedValue({
                data: {
                    id: 'user-123',
                    firstName: 'John',
                    lastName: 'Doe',
                    role: RoleEnum.USER
                },
                error: null
            });

            const app = initApp();

            await app.request('/api/v1/public/users/user-123', {
                method: 'PUT',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    displayName: 'Updated Name'
                })
            });

            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'guest',
                    role: 'GUEST',
                    permissions: expect.arrayContaining(['access.apiPublic'])
                }),
                'user-123',
                expect.any(Object)
            );
        });

        it('should handle service throwing exception', async () => {
            mockUpdate.mockRejectedValue(new Error('Database connection failed'));

            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
                method: 'PUT',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    displayName: 'Updated Name'
                })
            });

            expect(res.status).toBe(500);
        });

        it('should handle empty body', async () => {
            // Mock successful response for empty body test
            mockUpdate.mockResolvedValueOnce({
                data: {
                    id: 'user-123',
                    firstName: 'John',
                    lastName: 'Doe',
                    role: RoleEnum.USER
                },
                error: null
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
                method: 'PUT',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({})
            });

            expect(res.status).toBe(200);
            // Should still call the service with empty update data
        });
    });
});
