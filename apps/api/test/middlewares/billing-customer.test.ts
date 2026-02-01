/**
 * Tests for billingCustomerMiddleware
 *
 * Note: These tests focus on the middleware logic and edge cases.
 * The actual billing integration is tested separately in billing-customer-sync.test.ts
 */

import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { billingCustomerMiddleware } from '../../src/middlewares/billing-customer';
import type { AppBindings } from '../../src/types';

// Mock dependencies
vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn()
    }
}));

describe('billingCustomerMiddleware', () => {
    let mockContext: Partial<Context<AppBindings>>;
    let mockNext: ReturnType<typeof vi.fn>;
    let mockGetQZPayBilling: ReturnType<typeof vi.fn>;

    const mockActor: Actor = {
        id: 'user_123',
        role: RoleEnum.USER,
        permissions: []
    };

    const mockCustomer = {
        id: 'cus_abc123',
        externalId: 'user_123',
        email: 'user@example.com',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    beforeEach(async () => {
        // Reset mocks
        mockNext = vi.fn();
        const { getQZPayBilling } = await import('../../src/middlewares/billing');
        mockGetQZPayBilling = vi.mocked(getQZPayBilling);

        // Create mock context
        mockContext = {
            get: vi.fn((key: string) => {
                switch (key) {
                    case 'billingEnabled':
                        return true;
                    case 'actor':
                        return mockActor;
                    default:
                        return undefined;
                }
            }),
            set: vi.fn()
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Billing Disabled Scenarios', () => {
        it('should set billingCustomerId to null when billing is not enabled', async () => {
            // Arrange
            mockContext.get = vi.fn((key: string) => {
                if (key === 'billingEnabled') return false;
                if (key === 'actor') return mockActor;
                return undefined;
            });

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
            expect(mockNext).toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should not call getQZPayBilling when billing is disabled', async () => {
            // Arrange
            mockContext.get = vi.fn((key: string) => {
                if (key === 'billingEnabled') return false;
                if (key === 'actor') return mockActor;
                return undefined;
            });

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockGetQZPayBilling).not.toHaveBeenCalled();
        });

        it('should skip customer lookup when billingEnabled is undefined', async () => {
            // Arrange
            mockContext.get = vi.fn((key: string) => {
                if (key === 'billingEnabled') return undefined;
                if (key === 'actor') return mockActor;
                return undefined;
            });

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Authentication Scenarios', () => {
        it('should set billingCustomerId to null when no actor exists', async () => {
            // Arrange
            mockContext.get = vi.fn((key: string) => {
                if (key === 'billingEnabled') return true;
                if (key === 'actor') return null;
                return undefined;
            });

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should set billingCustomerId to null when actor has no id', async () => {
            // Arrange
            mockContext.get = vi.fn((key: string) => {
                if (key === 'billingEnabled') return true;
                if (key === 'actor') return { ...mockActor, id: undefined };
                return undefined;
            });

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should set billingCustomerId to null when actor id is empty string', async () => {
            // Arrange
            mockContext.get = vi.fn((key: string) => {
                if (key === 'billingEnabled') return true;
                if (key === 'actor') return { ...mockActor, id: '' };
                return undefined;
            });

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle actor with only whitespace id', async () => {
            // Arrange
            mockContext.get = vi.fn((key: string) => {
                if (key === 'billingEnabled') return true;
                if (key === 'actor') return { ...mockActor, id: '   ' };
                return undefined;
            });

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Customer Lookup Scenarios', () => {
        it('should set billingCustomerId when customer exists', async () => {
            // Arrange
            const mockBilling = {
                customers: {
                    getByExternalId: vi.fn().mockResolvedValue(mockCustomer)
                }
            };
            mockGetQZPayBilling.mockReturnValue(mockBilling as any);

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockBilling.customers.getByExternalId).toHaveBeenCalledWith('user_123');
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', 'cus_abc123');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should set billingCustomerId to null when customer does not exist', async () => {
            // Arrange
            const mockBilling = {
                customers: {
                    getByExternalId: vi.fn().mockResolvedValue(null)
                }
            };
            mockGetQZPayBilling.mockReturnValue(mockBilling as any);

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockBilling.customers.getByExternalId).toHaveBeenCalledWith('user_123');
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle customer lookup returning undefined', async () => {
            // Arrange
            const mockBilling = {
                customers: {
                    getByExternalId: vi.fn().mockResolvedValue(undefined)
                }
            };
            mockGetQZPayBilling.mockReturnValue(mockBilling as any);

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should use correct externalId for customer lookup', async () => {
            // Arrange
            const customActor = { ...mockActor, id: 'custom_user_456' };
            mockContext.get = vi.fn((key: string) => {
                if (key === 'billingEnabled') return true;
                if (key === 'actor') return customActor;
                return undefined;
            });

            const mockBilling = {
                customers: {
                    getByExternalId: vi.fn().mockResolvedValue(null)
                }
            };
            mockGetQZPayBilling.mockReturnValue(mockBilling as any);

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockBilling.customers.getByExternalId).toHaveBeenCalledWith('custom_user_456');
        });
    });

    describe('Error Handling Scenarios', () => {
        it('should set billingCustomerId to null when getQZPayBilling returns null', async () => {
            // Arrange
            mockGetQZPayBilling.mockReturnValue(null);

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should not throw errors when billing lookup fails with Error', async () => {
            // Arrange
            const mockBilling = {
                customers: {
                    getByExternalId: vi
                        .fn()
                        .mockRejectedValue(new Error('Database connection failed'))
                }
            };
            mockGetQZPayBilling.mockReturnValue(mockBilling as any);

            const middleware = billingCustomerMiddleware();

            // Act & Assert - should not throw
            await expect(
                middleware(mockContext as Context<AppBindings>, mockNext)
            ).resolves.toBeUndefined();
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should not throw errors when billing lookup fails with string error', async () => {
            // Arrange
            const mockBilling = {
                customers: {
                    getByExternalId: vi.fn().mockRejectedValue('Network timeout')
                }
            };
            mockGetQZPayBilling.mockReturnValue(mockBilling as any);

            const middleware = billingCustomerMiddleware();

            // Act & Assert - should not throw
            await expect(
                middleware(mockContext as Context<AppBindings>, mockNext)
            ).resolves.toBeUndefined();
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should not throw errors when billing lookup fails with unknown error type', async () => {
            // Arrange
            const mockBilling = {
                customers: {
                    getByExternalId: vi.fn().mockRejectedValue({ code: 'UNKNOWN_ERROR' })
                }
            };
            mockGetQZPayBilling.mockReturnValue(mockBilling as any);

            const middleware = billingCustomerMiddleware();

            // Act & Assert - should not throw
            await expect(
                middleware(mockContext as Context<AppBindings>, mockNext)
            ).resolves.toBeUndefined();
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle billing instance with missing customers property', async () => {
            // Arrange
            mockGetQZPayBilling.mockReturnValue({} as any);

            const middleware = billingCustomerMiddleware();

            // Act & Assert
            await expect(
                middleware(mockContext as Context<AppBindings>, mockNext)
            ).resolves.toBeUndefined();
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Context Variable Setting', () => {
        it('should always set billingCustomerId context variable', async () => {
            // Arrange
            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert - billingCustomerId should be set
            const mockSet = vi.mocked(mockContext.set!);
            const setCall = mockSet.mock.calls.find(
                (call: any[]) => call[0] === 'billingCustomerId'
            );
            expect(setCall).toBeDefined();
            expect(setCall?.[0]).toBe('billingCustomerId');
            // Value can be null or a string (depends on billing state)
            expect(setCall?.[1] === null || typeof setCall?.[1] === 'string').toBe(true);
        });

        it('should only set billingCustomerId once per request', async () => {
            // Arrange
            const mockBilling = {
                customers: {
                    getByExternalId: vi.fn().mockResolvedValue(mockCustomer)
                }
            };
            mockGetQZPayBilling.mockReturnValue(mockBilling as any);

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            const mockSet = vi.mocked(mockContext.set!);
            const setCalls = mockSet.mock.calls.filter(
                (call: any[]) => call[0] === 'billingCustomerId'
            );
            expect(setCalls.length).toBe(1);
        });

        it('should preserve customer ID type as string when set', async () => {
            // Arrange
            const mockBilling = {
                customers: {
                    getByExternalId: vi.fn().mockResolvedValue(mockCustomer)
                }
            };
            mockGetQZPayBilling.mockReturnValue(mockBilling as any);

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', 'cus_abc123');
            const mockSet = vi.mocked(mockContext.set!);
            const setCall = mockSet.mock.calls[0] as any[];
            expect(typeof setCall[1]).toBe('string');
        });
    });

    describe('Middleware Execution Flow', () => {
        it('should always call next middleware', async () => {
            // Arrange
            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockNext).toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should call next middleware even when billing is disabled', async () => {
            // Arrange
            mockContext.get = vi.fn((key: string) => {
                if (key === 'billingEnabled') return false;
                return undefined;
            });

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockNext).toHaveBeenCalled();
        });

        it('should call next middleware even when customer lookup throws', async () => {
            // Arrange
            const mockBilling = {
                customers: {
                    getByExternalId: vi.fn().mockRejectedValue(new Error('Lookup failed'))
                }
            };
            mockGetQZPayBilling.mockReturnValue(mockBilling as any);

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockNext).toHaveBeenCalled();
        });

        it('should complete execution in correct order: set then next', async () => {
            // Arrange
            const executionOrder: string[] = [];

            mockContext.set = vi.fn((..._args: any[]) => {
                executionOrder.push('set');
            });

            mockNext.mockImplementation(() => {
                executionOrder.push('next');
            });

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(executionOrder).toEqual(['set', 'next']);
        });
    });

    describe('Multiple Actor Roles', () => {
        it('should handle HOST actor correctly', async () => {
            // Arrange
            const hostActor: Actor = {
                id: 'host_789',
                role: RoleEnum.HOST,
                permissions: []
            };

            mockContext.get = vi.fn((key: string) => {
                if (key === 'billingEnabled') return true;
                if (key === 'actor') return hostActor;
                return undefined;
            });

            const mockBilling = {
                customers: {
                    getByExternalId: vi.fn().mockResolvedValue({
                        ...mockCustomer,
                        id: 'cus_host789',
                        externalId: 'host_789'
                    })
                }
            };
            mockGetQZPayBilling.mockReturnValue(mockBilling as any);

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockBilling.customers.getByExternalId).toHaveBeenCalledWith('host_789');
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', 'cus_host789');
        });

        it('should handle ADMIN actor correctly', async () => {
            // Arrange
            const adminActor: Actor = {
                id: 'admin_999',
                role: RoleEnum.ADMIN,
                permissions: []
            };

            mockContext.get = vi.fn((key: string) => {
                if (key === 'billingEnabled') return true;
                if (key === 'actor') return adminActor;
                return undefined;
            });

            const mockBilling = {
                customers: {
                    getByExternalId: vi.fn().mockResolvedValue(null)
                }
            };
            mockGetQZPayBilling.mockReturnValue(mockBilling as any);

            const middleware = billingCustomerMiddleware();

            // Act
            await middleware(mockContext as Context<AppBindings>, mockNext);

            // Assert
            expect(mockBilling.customers.getByExternalId).toHaveBeenCalledWith('admin_999');
            expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
        });
    });
});
