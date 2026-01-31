/**
 * Unit Tests: Customer Lookup Helper
 *
 * Tests the customer lookup utility that retrieves customer details from QZPay billing.
 *
 * Test Coverage:
 * - Customer found with full metadata
 * - Customer found without metadata (uses email as name, null userId)
 * - Customer not found (returns null, logs warning)
 * - Billing API throws error (returns null, logs warning)
 *
 * @module test/utils/customer-lookup
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupCustomerDetails } from '../../src/utils/customer-lookup';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

import { apiLogger } from '../../src/utils/logger';

describe('Customer Lookup Helper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('lookupCustomerDetails', () => {
        it('should return customer details when customer is found', async () => {
            // Arrange
            const mockCustomer = {
                id: 'cust-123',
                email: 'user@example.com',
                metadata: {
                    name: 'John Doe',
                    userId: 'user-456'
                }
            };

            const mockBilling = {
                customers: {
                    get: vi.fn().mockResolvedValue(mockCustomer)
                }
            } as unknown as QZPayBilling;

            // Act
            const result = await lookupCustomerDetails(mockBilling, 'cust-123');

            // Assert
            expect(result).toEqual({
                email: 'user@example.com',
                name: 'John Doe',
                userId: 'user-456'
            });
            expect(mockBilling.customers.get).toHaveBeenCalledWith('cust-123');
            expect(apiLogger.warn).not.toHaveBeenCalled();
        });

        it('should use email as name when metadata.name is missing', async () => {
            // Arrange
            const mockCustomer = {
                id: 'cust-123',
                email: 'user@example.com',
                metadata: {
                    userId: 'user-456'
                    // No name in metadata
                }
            };

            const mockBilling = {
                customers: {
                    get: vi.fn().mockResolvedValue(mockCustomer)
                }
            } as unknown as QZPayBilling;

            // Act
            const result = await lookupCustomerDetails(mockBilling, 'cust-123');

            // Assert
            expect(result).toEqual({
                email: 'user@example.com',
                name: 'user@example.com', // Falls back to email
                userId: 'user-456'
            });
        });

        it('should return null userId when metadata.userId is missing', async () => {
            // Arrange
            const mockCustomer = {
                id: 'cust-123',
                email: 'user@example.com',
                metadata: {
                    name: 'John Doe'
                    // No userId in metadata
                }
            };

            const mockBilling = {
                customers: {
                    get: vi.fn().mockResolvedValue(mockCustomer)
                }
            } as unknown as QZPayBilling;

            // Act
            const result = await lookupCustomerDetails(mockBilling, 'cust-123');

            // Assert
            expect(result).toEqual({
                email: 'user@example.com',
                name: 'John Doe',
                userId: null
            });
        });

        it('should handle customer with no metadata', async () => {
            // Arrange
            const mockCustomer = {
                id: 'cust-123',
                email: 'user@example.com'
                // No metadata at all
            };

            const mockBilling = {
                customers: {
                    get: vi.fn().mockResolvedValue(mockCustomer)
                }
            } as unknown as QZPayBilling;

            // Act
            const result = await lookupCustomerDetails(mockBilling, 'cust-123');

            // Assert
            expect(result).toEqual({
                email: 'user@example.com',
                name: 'user@example.com', // Falls back to email
                userId: null
            });
        });

        it('should return null and log warning when customer not found', async () => {
            // Arrange
            const mockBilling = {
                customers: {
                    get: vi.fn().mockResolvedValue(null)
                }
            } as unknown as QZPayBilling;

            // Act
            const result = await lookupCustomerDetails(mockBilling, 'cust-not-found');

            // Assert
            expect(result).toBeNull();
            expect(mockBilling.customers.get).toHaveBeenCalledWith('cust-not-found');
            expect(apiLogger.warn).toHaveBeenCalledWith(
                { customerId: 'cust-not-found' },
                'Customer not found in billing system'
            );
        });

        it('should return null and log warning when billing API throws error', async () => {
            // Arrange
            const mockError = new Error('Billing API unavailable');
            const mockBilling = {
                customers: {
                    get: vi.fn().mockRejectedValue(mockError)
                }
            } as unknown as QZPayBilling;

            // Act
            const result = await lookupCustomerDetails(mockBilling, 'cust-123');

            // Assert
            expect(result).toBeNull();
            expect(apiLogger.warn).toHaveBeenCalledWith(
                {
                    customerId: 'cust-123',
                    error: 'Billing API unavailable'
                },
                'Failed to look up customer details'
            );
        });

        it('should handle non-Error exceptions', async () => {
            // Arrange
            const mockBilling = {
                customers: {
                    get: vi.fn().mockRejectedValue('String error')
                }
            } as unknown as QZPayBilling;

            // Act
            const result = await lookupCustomerDetails(mockBilling, 'cust-123');

            // Assert
            expect(result).toBeNull();
            expect(apiLogger.warn).toHaveBeenCalledWith(
                {
                    customerId: 'cust-123',
                    error: 'String error'
                },
                'Failed to look up customer details'
            );
        });

        it('should convert metadata values to strings', async () => {
            // Arrange
            const mockCustomer = {
                id: 'cust-123',
                email: 'user@example.com',
                metadata: {
                    name: 123, // Number instead of string
                    userId: 456 // Number instead of string
                }
            };

            const mockBilling = {
                customers: {
                    get: vi.fn().mockResolvedValue(mockCustomer)
                }
            } as unknown as QZPayBilling;

            // Act
            const result = await lookupCustomerDetails(mockBilling, 'cust-123');

            // Assert
            expect(result).toEqual({
                email: 'user@example.com',
                name: '123',
                userId: '456'
            });
        });
    });
});
