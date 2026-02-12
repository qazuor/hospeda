/**
 * Tests for BillingCustomerSyncService
 */

import type { QZPayBilling, QZPayCustomer } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingCustomerSyncService } from '../../src/services/billing-customer-sync';

describe('BillingCustomerSyncService', () => {
    let mockBilling: Partial<QZPayBilling>;
    let service: BillingCustomerSyncService;

    const mockCustomer: QZPayCustomer = {
        id: 'cus_123',
        externalId: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        phone: null,
        providerCustomerIds: {},
        metadata: {},
        livemode: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
    };

    beforeEach(() => {
        // Create mock billing instance
        mockBilling = {
            customers: {
                getByExternalId: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                delete: vi.fn()
            } as unknown as QZPayBilling['customers']
        };

        // Create service instance
        service = new BillingCustomerSyncService(mockBilling as QZPayBilling, {
            cacheTtlMs: 1000,
            throwOnError: false
        });
    });

    describe('ensureCustomerExists', () => {
        it('should return null when billing is not enabled', async () => {
            // Arrange
            const nullService = new BillingCustomerSyncService(null);

            // Act
            const result = await nullService.ensureCustomerExists({
                userId: 'user_123',
                email: 'test@example.com',
                name: 'Test User'
            });

            // Assert
            expect(result).toBeNull();
        });

        it('should return cached customer ID if available', async () => {
            // Arrange
            vi.mocked(mockBilling.customers!.getByExternalId).mockResolvedValue(mockCustomer);

            // First call to populate cache
            await service.ensureCustomerExists({
                userId: 'user_123',
                email: 'test@example.com',
                name: 'Test User'
            });

            // Act - second call should use cache
            const result = await service.ensureCustomerExists({
                userId: 'user_123',
                email: 'test@example.com',
                name: 'Test User'
            });

            // Assert
            expect(result).toBe('cus_123');
            // Should only call getByExternalId once (first time)
            expect(mockBilling.customers!.getByExternalId).toHaveBeenCalledTimes(1);
        });

        it('should find existing customer in database', async () => {
            // Arrange
            vi.mocked(mockBilling.customers!.getByExternalId).mockResolvedValue(mockCustomer);

            // Act
            const result = await service.ensureCustomerExists({
                userId: 'user_123',
                email: 'test@example.com',
                name: 'Test User'
            });

            // Assert
            expect(result).toBe('cus_123');
            expect(mockBilling.customers!.getByExternalId).toHaveBeenCalledWith('user_123');
        });

        it('should create new customer if not exists', async () => {
            // Arrange
            vi.mocked(mockBilling.customers!.getByExternalId).mockResolvedValue(null);
            vi.mocked(mockBilling.customers!.create).mockResolvedValue({
                ...mockCustomer,
                id: 'cus_new'
            });

            // Act
            const result = await service.ensureCustomerExists({
                userId: 'user_456',
                email: 'new@example.com',
                name: 'New User'
            });

            // Assert
            expect(result).toBe('cus_new');
            expect(mockBilling.customers!.create).toHaveBeenCalledWith({
                externalId: 'user_456',
                email: 'new@example.com',
                name: 'New User',
                metadata: {
                    source: 'better-auth',
                    createdBy: 'billing-customer-sync-service'
                }
            });
        });

        it('should handle errors gracefully when throwOnError is false', async () => {
            // Arrange
            vi.mocked(mockBilling.customers!.getByExternalId).mockRejectedValue(
                new Error('Database error')
            );

            // Act
            const result = await service.ensureCustomerExists({
                userId: 'user_123',
                email: 'test@example.com',
                name: 'Test User'
            });

            // Assert
            expect(result).toBeNull();
        });

        it('should throw errors when throwOnError is true', async () => {
            // Arrange
            const throwService = new BillingCustomerSyncService(mockBilling as QZPayBilling, {
                throwOnError: true
            });
            vi.mocked(mockBilling.customers!.getByExternalId).mockRejectedValue(
                new Error('Database error')
            );

            // Act & Assert
            await expect(
                throwService.ensureCustomerExists({
                    userId: 'user_123',
                    email: 'test@example.com',
                    name: 'Test User'
                })
            ).rejects.toThrow('Database error');
        });
    });

    describe('syncCustomerData', () => {
        it('should return null when billing is not enabled', async () => {
            // Arrange
            const nullService = new BillingCustomerSyncService(null);

            // Act
            const result = await nullService.syncCustomerData({
                userId: 'user_123',
                email: 'test@example.com',
                name: 'Test User'
            });

            // Assert
            expect(result).toBeNull();
        });

        it('should create customer if not exists', async () => {
            // Arrange
            vi.mocked(mockBilling.customers!.getByExternalId).mockResolvedValue(null);
            vi.mocked(mockBilling.customers!.create).mockResolvedValue({
                ...mockCustomer,
                id: 'cus_new'
            });

            // Act
            const result = await service.syncCustomerData({
                userId: 'user_456',
                email: 'new@example.com',
                name: 'New User'
            });

            // Assert
            expect(result).toBe('cus_new');
        });

        it('should skip update if data is already up to date', async () => {
            // Arrange
            vi.mocked(mockBilling.customers!.getByExternalId).mockResolvedValue(mockCustomer);

            // Act
            const result = await service.syncCustomerData({
                userId: 'user_123',
                email: 'test@example.com',
                name: 'Test User'
            });

            // Assert
            expect(result).toBe('cus_123');
            expect(mockBilling.customers!.update).not.toHaveBeenCalled();
        });

        it('should update customer if email changed', async () => {
            // Arrange
            vi.mocked(mockBilling.customers!.getByExternalId).mockResolvedValue(mockCustomer);
            vi.mocked(mockBilling.customers!.update).mockResolvedValue({
                ...mockCustomer,
                email: 'updated@example.com'
            });

            // Act
            const result = await service.syncCustomerData({
                userId: 'user_123',
                email: 'updated@example.com',
                name: 'Test User'
            });

            // Assert
            expect(result).toBe('cus_123');
            expect(mockBilling.customers!.update).toHaveBeenCalledWith('cus_123', {
                email: 'updated@example.com',
                name: 'Test User',
                metadata: {
                    lastSyncedAt: expect.any(String)
                }
            });
        });

        it('should update customer if name changed', async () => {
            // Arrange
            vi.mocked(mockBilling.customers!.getByExternalId).mockResolvedValue(mockCustomer);
            vi.mocked(mockBilling.customers!.update).mockResolvedValue({
                ...mockCustomer,
                name: 'Updated User'
            });

            // Act
            const result = await service.syncCustomerData({
                userId: 'user_123',
                email: 'test@example.com',
                name: 'Updated User'
            });

            // Assert
            expect(result).toBe('cus_123');
            expect(mockBilling.customers!.update).toHaveBeenCalled();
        });
    });

    describe('handleUserDeletion', () => {
        it('should do nothing when billing is not enabled', async () => {
            // Arrange
            const nullService = new BillingCustomerSyncService(null);

            // Act
            await nullService.handleUserDeletion({ userId: 'user_123' });

            // Assert - no errors thrown
            expect(true).toBe(true);
        });

        it('should delete customer if exists', async () => {
            // Arrange
            vi.mocked(mockBilling.customers!.getByExternalId).mockResolvedValue(mockCustomer);

            // Act
            await service.handleUserDeletion({ userId: 'user_123' });

            // Assert
            expect(mockBilling.customers!.delete).toHaveBeenCalledWith('cus_123');
        });

        it('should skip deletion if customer not found', async () => {
            // Arrange
            vi.mocked(mockBilling.customers!.getByExternalId).mockResolvedValue(null);

            // Act
            await service.handleUserDeletion({ userId: 'user_123' });

            // Assert
            expect(mockBilling.customers!.delete).not.toHaveBeenCalled();
        });

        it('should clear cache after deletion', async () => {
            // Arrange
            vi.mocked(mockBilling.customers!.getByExternalId).mockResolvedValue(mockCustomer);

            // Populate cache first
            await service.ensureCustomerExists({
                userId: 'user_123',
                email: 'test@example.com'
            });

            // Act
            await service.handleUserDeletion({ userId: 'user_123' });

            // Assert - cache should be cleared
            const stats = service.getCacheStats();
            expect(stats.entries.find((e) => e.userId === 'user_123')).toBeUndefined();
        });
    });

    describe('cache management', () => {
        it('should clear entire cache', async () => {
            // Arrange
            vi.mocked(mockBilling.customers!.getByExternalId).mockResolvedValue(mockCustomer);

            await service.ensureCustomerExists({
                userId: 'user_1',
                email: 'user1@example.com'
            });
            await service.ensureCustomerExists({
                userId: 'user_2',
                email: 'user2@example.com'
            });

            // Act
            service.clearCache();

            // Assert
            const stats = service.getCacheStats();
            expect(stats.size).toBe(0);
            expect(stats.entries).toHaveLength(0);
        });

        it('should expire cached entries after TTL', async () => {
            // Arrange
            const shortTtlService = new BillingCustomerSyncService(mockBilling as QZPayBilling, {
                cacheTtlMs: 100
            });

            vi.mocked(mockBilling.customers!.getByExternalId).mockResolvedValue(mockCustomer);

            // First call
            await shortTtlService.ensureCustomerExists({
                userId: 'user_123',
                email: 'test@example.com'
            });

            // Wait for cache to expire
            await new Promise((resolve) => setTimeout(resolve, 150));

            // Act - should hit database again
            await shortTtlService.ensureCustomerExists({
                userId: 'user_123',
                email: 'test@example.com'
            });

            // Assert - should have called getByExternalId twice
            expect(mockBilling.customers!.getByExternalId).toHaveBeenCalledTimes(2);
        });

        it('should return cache statistics', async () => {
            // Arrange
            vi.mocked(mockBilling.customers!.getByExternalId).mockResolvedValue(mockCustomer);

            await service.ensureCustomerExists({
                userId: 'user_1',
                email: 'user1@example.com'
            });

            // Act
            const stats = service.getCacheStats();

            // Assert
            expect(stats.size).toBe(1);
            expect(stats.entries).toHaveLength(1);
            expect(stats.entries[0]).toMatchObject({
                userId: 'user_1',
                customerId: 'cus_123',
                age: expect.any(Number)
            });
        });
    });
});
