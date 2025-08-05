/**
 * Tests for user getById route with mocked UserService
 * Tests the user getById endpoint with service mocking
 */

import { LifecycleStatusEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';

// Mock the UserService
vi.mock('@repo/service-core', () => {
    const mockGetById = vi.fn();

    return {
        UserService: vi.fn().mockImplementation(() => ({
            getById: mockGetById
        }))
    };
});

// Get the mocked function after the mock is set up
const { UserService } = await import('@repo/service-core');
const mockGetById = (UserService as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value
    ?.getById;

describe('User GetById Route (With Service Mocking)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/v1/public/users/{id}', () => {
        it('should return success response with user data', async () => {
            // Mock successful response
            mockGetById.mockResolvedValue({
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

            const res = await app.request('/api/v1/public/users/user-123', {
                headers: {
                    'user-agent': 'test-agent'
                }
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
            expect(mockGetById).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'guest',
                    role: 'GUEST'
                }),
                'user-123'
            );
        });

        it('should handle user not found', async () => {
            // Mock not found response
            mockGetById.mockResolvedValue({
                data: null,
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                }
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users/non-existent', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(500);
            const data = await res.json();

            expect(data.success).toBe(false);
            expect(data.error).toMatchObject({
                code: expect.stringMatching(/INTERNAL_ERROR|NOT_FOUND/),
                message: expect.any(String)
            });
        });

        it('should handle service errors gracefully', async () => {
            // Mock error response
            mockGetById.mockResolvedValue({
                data: null,
                error: {
                    code: 'PERMISSION_DENIED',
                    message: 'User does not have permission to view this user'
                }
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
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

        it('should handle null user response', async () => {
            // Mock null response (user not found)
            mockGetById.mockResolvedValue({
                data: null,
                error: null
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.success).toBe(true);
            expect(data.data).toBeNull();
        });
    });

    describe('Validation', () => {
        it('should reject requests without user-agent', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
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
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
        });

        it('should accept requests with valid Accept header', async () => {
            mockGetById.mockResolvedValue({
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
            mockGetById.mockResolvedValue({
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
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(mockGetById).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'guest',
                    role: 'GUEST',
                    permissions: expect.arrayContaining(['access.apiPublic'])
                }),
                'user-123'
            );
        });

        it('should handle service throwing exception', async () => {
            mockGetById.mockRejectedValue(new Error('Database connection failed'));

            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-123', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(500);
        });

        it('should handle different user IDs', async () => {
            mockGetById.mockResolvedValue({
                data: {
                    id: 'user-456',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    role: RoleEnum.ADMIN
                },
                error: null
            });

            const app = initApp();

            const res = await app.request('/api/v1/public/users/user-456', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            expect(data.data.id).toBe('user-456');
            expect(data.data.firstName).toBe('Jane');
            expect(data.data.lastName).toBe('Smith');
            expect(data.data.role).toBe(RoleEnum.ADMIN);

            expect(mockGetById).toHaveBeenCalledWith(expect.any(Object), 'user-456');
        });
    });
});
