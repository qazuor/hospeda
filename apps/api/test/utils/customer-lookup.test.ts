/**
 * Unit Tests: Customer Lookup Helper
 *
 * Tests the customer lookup utility that retrieves customer details from QZPay billing.
 *
 * Test Coverage:
 * - Customer found, userId resolved from `billing_customers.external_id` (HOS-223)
 * - Customer found without metadata (uses email as name)
 * - userId resolves to null when no matching `billing_customers` row exists
 * - `billing_customers.external_id` lookup failure degrades to null userId,
 *   email/name still returned (cron consumers must not break)
 * - Customer not found (returns null, logs warning)
 * - Billing API throws error (returns null, logs warning)
 *
 * @module test/utils/customer-lookup
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock @repo/db — getDb is replaced per-test via setupDbMock. The table
// object only needs to exist as an identifier for eq()/select() calls.
const { mockGetDb } = vi.hoisted(() => ({ mockGetDb: vi.fn() }));
vi.mock('@repo/db', () => ({
    billingCustomers: { id: 'bc-id', externalId: 'bc-externalId' },
    eq: vi.fn((_a: unknown, _b: unknown) => ({ _eq: true })),
    getDb: mockGetDb
}));

import { lookupCustomerDetails } from '../../src/utils/customer-lookup';
import { apiLogger } from '../../src/utils/logger';

/**
 * Wires `mockGetDb` so `db.select().from().where().limit()` resolves with `rows`.
 */
function setupDbMock(rows: Array<{ externalId: string | null }>) {
    const limitMock = vi.fn().mockResolvedValue(rows);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    mockGetDb.mockReturnValue({ select: selectMock });
    return { selectMock, fromMock, whereMock, limitMock };
}

/**
 * Wires `mockGetDb` so the underlying db call rejects (simulating a DB error).
 */
function setupDbMockError(error: unknown) {
    const limitMock = vi.fn().mockRejectedValue(error);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    mockGetDb.mockReturnValue({ select: selectMock });
}

describe('Customer Lookup Helper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('lookupCustomerDetails', () => {
        it('should resolve userId from billing_customers.external_id when metadata has no userId key (HOS-223 regression)', async () => {
            // Arrange — this is the real-world shape: customers are created by
            // billing-customer-sync.ts with `externalId: userId` but a metadata
            // object that never contains a `userId` key.
            const mockCustomer = {
                id: 'cust-123',
                email: 'user@example.com',
                metadata: {
                    source: 'better-auth',
                    createdBy: 'billing-customer-sync-service'
                    // No userId in metadata — this is the actual production shape
                }
            };

            const mockBilling = {
                customers: {
                    get: vi.fn().mockResolvedValue(mockCustomer)
                }
            } as unknown as QZPayBilling;

            setupDbMock([{ externalId: 'user-456' }]);

            // Act
            const result = await lookupCustomerDetails(mockBilling, 'cust-123');

            // Assert — before the fix, userId was always null because it only
            // ever read the (never-written) metadata.userId key.
            expect(result).toEqual({
                email: 'user@example.com',
                name: 'user@example.com',
                userId: 'user-456'
            });
        });

        it('should use email as name when metadata.name is missing', async () => {
            // Arrange
            const mockCustomer = {
                id: 'cust-123',
                email: 'user@example.com',
                metadata: {}
            };

            const mockBilling = {
                customers: {
                    get: vi.fn().mockResolvedValue(mockCustomer)
                }
            } as unknown as QZPayBilling;

            setupDbMock([{ externalId: 'user-456' }]);

            // Act
            const result = await lookupCustomerDetails(mockBilling, 'cust-123');

            // Assert
            expect(result).toEqual({
                email: 'user@example.com',
                name: 'user@example.com', // Falls back to email
                userId: 'user-456'
            });
        });

        it('should return null userId when no matching billing_customers row exists', async () => {
            // Arrange
            const mockCustomer = {
                id: 'cust-123',
                email: 'user@example.com',
                metadata: { name: 'John Doe' }
            };

            const mockBilling = {
                customers: {
                    get: vi.fn().mockResolvedValue(mockCustomer)
                }
            } as unknown as QZPayBilling;

            setupDbMock([]);

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

            setupDbMock([{ externalId: 'user-456' }]);

            // Act
            const result = await lookupCustomerDetails(mockBilling, 'cust-123');

            // Assert
            expect(result).toEqual({
                email: 'user@example.com',
                name: 'user@example.com', // Falls back to email
                userId: 'user-456'
            });
        });

        it('should degrade to null userId (keeping email/name) when the DB lookup fails', async () => {
            // Arrange — cron consumers depend on email/name surviving even if
            // the external_id resolution has a transient DB failure.
            const mockCustomer = {
                id: 'cust-123',
                email: 'user@example.com',
                metadata: { name: 'John Doe' }
            };

            const mockBilling = {
                customers: {
                    get: vi.fn().mockResolvedValue(mockCustomer)
                }
            } as unknown as QZPayBilling;

            setupDbMockError(new Error('DB unavailable'));

            // Act
            const result = await lookupCustomerDetails(mockBilling, 'cust-123');

            // Assert
            expect(result).toEqual({
                email: 'user@example.com',
                name: 'John Doe',
                userId: null
            });
            expect(apiLogger.warn).toHaveBeenCalledWith(
                { customerId: 'cust-123', error: 'DB unavailable' },
                'Failed to resolve userId from billing_customers.external_id'
            );
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

        it('should convert metadata.name to string', async () => {
            // Arrange
            const mockCustomer = {
                id: 'cust-123',
                email: 'user@example.com',
                metadata: {
                    name: 123 // Number instead of string
                }
            };

            const mockBilling = {
                customers: {
                    get: vi.fn().mockResolvedValue(mockCustomer)
                }
            } as unknown as QZPayBilling;

            setupDbMock([{ externalId: 'user-456' }]);

            // Act
            const result = await lookupCustomerDetails(mockBilling, 'cust-123');

            // Assert
            expect(result).toEqual({
                email: 'user@example.com',
                name: '123',
                userId: 'user-456'
            });
        });
    });
});
