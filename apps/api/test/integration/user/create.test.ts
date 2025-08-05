/**
 * Tests for user create route with mocked UserService
 * Tests the user create endpoint with service mocking
 */

import { LifecycleStatusEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';

// Mock the UserService
vi.mock('@repo/service-core', () => {
    const mockCreate = vi.fn();

    return {
        UserService: vi.fn().mockImplementation(() => ({
            create: mockCreate
        }))
    };
});

// Get the mocked function after the mock is set up
const { UserService } = await import('@repo/service-core');
const mockCreate = (UserService as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value
    ?.create;

describe('User Create Route (With Service Mocking)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /api/v1/public/users', () => {
        it('should return success response with created user', async () => {
            // Mock successful response
            mockCreate.mockResolvedValue({
                data: {
                    id: 'user-123',
                    firstName: 'John',
                    lastName: 'Doe',
                    displayName: 'John Doe',
                    role: RoleEnum.USER,
                    permissions: [],
                    slug: 'john-doe',
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    visibility: VisibilityEnum.PUBLIC,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                error: null
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    firstName: 'John',
                    lastName: 'Doe',
                    displayName: 'John Doe',
                    role: RoleEnum.USER
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.success).toBe(true);
            expect(data.data).toBeDefined();
            expect(data.data.id).toBe('user-123');
            expect(data.data.firstName).toBe('John');
            expect(data.data.lastName).toBe('Doe');
            expect(data.data.displayName).toBe('John Doe');
            expect(data.data.role).toBe(RoleEnum.USER);

            // Check metadata
            expect(data.metadata).toBeDefined();
            expect(data.metadata.timestamp).toBeDefined();
            expect(data.metadata.requestId).toBeDefined();

            // Verify service was called correctly
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'guest',
                    role: 'GUEST'
                }),
                {
                    firstName: 'John',
                    lastName: 'Doe',
                    displayName: 'John Doe',
                    role: RoleEnum.USER,
                    permissions: [],
                    slug: '',
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    visibility: VisibilityEnum.PUBLIC
                }
            );
        });

        it('should handle service errors gracefully', async () => {
            // Mock error response
            mockCreate.mockResolvedValue({
                data: null,
                error: {
                    code: 'PERMISSION_DENIED',
                    message: 'Only super admin can create users'
                }
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    firstName: 'John',
                    lastName: 'Doe',
                    role: RoleEnum.USER
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

        it('should validate required fields', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    // Missing required fields
                    displayName: 'John Doe'
                })
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
        });

        it('should validate field lengths', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    firstName: 'J', // Too short
                    lastName: 'D', // Too short
                    role: RoleEnum.USER
                })
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
        });

        it('should handle invalid role enum', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    firstName: 'John',
                    lastName: 'Doe',
                    role: 'INVALID_ROLE'
                })
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
        });
    });

    describe('Validation', () => {
        it('should reject requests without user-agent', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json'
                    // Missing user-agent
                },
                body: JSON.stringify({
                    firstName: 'John',
                    lastName: 'Doe',
                    role: RoleEnum.USER
                })
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('MISSING_REQUIRED_HEADER');
        });

        it('should reject requests without content-type', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'test-agent'
                    // Missing content-type
                },
                body: JSON.stringify({
                    firstName: 'John',
                    lastName: 'Doe',
                    role: RoleEnum.USER
                })
            });

            expect(res.status).toBe(400);
        });
    });

    describe('Service Integration', () => {
        it('should pass correct actor to service', async () => {
            mockCreate.mockResolvedValue({
                data: {
                    id: 'user-123',
                    firstName: 'John',
                    lastName: 'Doe',
                    role: RoleEnum.USER
                },
                error: null
            });

            const app = initApp();

            await app.request('/api/v1/public/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    firstName: 'John',
                    lastName: 'Doe',
                    role: RoleEnum.USER
                })
            });

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'guest',
                    role: 'GUEST',
                    permissions: expect.arrayContaining(['access.apiPublic'])
                }),
                expect.any(Object)
            );
        });

        it('should handle service throwing exception', async () => {
            mockCreate.mockRejectedValue(new Error('Database connection failed'));

            const app = initApp();

            const res = await app.request('/api/v1/public/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    firstName: 'John',
                    lastName: 'Doe',
                    role: RoleEnum.USER
                })
            });

            expect(res.status).toBe(500);
        });
    });
});
