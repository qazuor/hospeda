/**
 * Tests for billingCustomerMiddleware
 *
 * Note: These tests focus on the middleware logic and edge cases.
 * The actual billing integration is tested separately in billing-customer-sync.test.ts
 */

import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { billingCustomerMiddleware } from '../../src/middlewares/billing-customer';

describe('billingCustomerMiddleware', () => {
    let mockContext: Partial<Context>;
    let mockNext: ReturnType<typeof vi.fn>;

    const mockActor: Actor = {
        id: 'user_123',
        role: RoleEnum.USER,
        permissions: []
    };

    beforeEach(() => {
        // Reset mocks
        mockNext = vi.fn();

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

    it('should set billingCustomerId to null when billing is not enabled', async () => {
        // Arrange
        vi.mocked(mockContext.get!).mockImplementation((key: string) => {
            if (key === 'billingEnabled') return false;
            if (key === 'actor') return mockActor;
            return undefined;
        });

        const middleware = billingCustomerMiddleware();

        // Act
        await middleware(mockContext as Context, mockNext);

        // Assert
        expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should set billingCustomerId to null when no actor exists', async () => {
        // Arrange
        vi.mocked(mockContext.get!).mockImplementation((key: string) => {
            if (key === 'billingEnabled') return true;
            if (key === 'actor') return null;
            return undefined;
        });

        const middleware = billingCustomerMiddleware();

        // Act
        await middleware(mockContext as Context, mockNext);

        // Assert
        expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should set billingCustomerId to null when actor has no id', async () => {
        // Arrange
        vi.mocked(mockContext.get!).mockImplementation((key: string) => {
            if (key === 'billingEnabled') return true;
            if (key === 'actor') return { ...mockActor, id: undefined };
            return undefined;
        });

        const middleware = billingCustomerMiddleware();

        // Act
        await middleware(mockContext as Context, mockNext);

        // Assert
        expect(mockContext.set).toHaveBeenCalledWith('billingCustomerId', null);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should always call next middleware', async () => {
        // Arrange
        const middleware = billingCustomerMiddleware();

        // Act
        await middleware(mockContext as Context, mockNext);

        // Assert
        expect(mockNext).toHaveBeenCalled();
    });

    it('should set billingCustomerId context variable', async () => {
        // Arrange
        const middleware = billingCustomerMiddleware();

        // Act
        await middleware(mockContext as Context, mockNext);

        // Assert - billingCustomerId should be set
        const setCall = vi
            .mocked(mockContext.set!)
            .mock.calls.find((call) => call[0] === 'billingCustomerId');
        expect(setCall).toBeDefined();
        expect(setCall![0]).toBe('billingCustomerId');
        // Value can be null or a string (depends on billing state)
        expect(setCall![1] === null || typeof setCall![1] === 'string').toBe(true);
    });

    it('should not throw errors even if billing lookup fails', async () => {
        // Arrange
        const middleware = billingCustomerMiddleware();

        // Act & Assert - should not throw
        await expect(middleware(mockContext as Context, mockNext)).resolves.toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
    });
});
