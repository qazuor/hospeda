import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentMethodModel } from '../../src/models/invoice/paymentMethod.model';

// Mock the database client
vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

// Mock logger to avoid console output during tests
vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('PaymentMethodModel', () => {
    let model: PaymentMethodModel;
    let mockDb: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new PaymentMethodModel();

        // Setup mock database
        mockDb = {
            query: {
                paymentMethods: {
                    findFirst: vi.fn(),
                    findMany: vi.fn()
                }
            },
            insert: vi.fn(() => ({
                values: vi.fn(() => ({
                    returning: vi.fn()
                }))
            })),
            update: vi.fn(() => ({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        returning: vi.fn()
                    }))
                }))
            })),
            select: vi.fn(),
            transaction: vi.fn()
        };

        const clientModule = await import('../../src/client');
        vi.mocked(clientModule.getDb).mockReturnValue(mockDb);
    });

    describe('Constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(PaymentMethodModel);
        });

        it('should have correct table name', () => {
            const tableName = (model as any).getTableName();
            expect(tableName).toBe('payment_methods');
        });
    });

    describe('validateCard', () => {
        it('should validate valid card data', async () => {
            const cardData = {
                number: '4532015112830366', // Valid test Visa
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '123'
            };

            const result = await model.validateCard(cardData);

            expect(result.valid).toBe(true);
            expect(result.reason).toBeUndefined();
        });

        it('should reject invalid card number (Luhn check)', async () => {
            const cardData = {
                number: '1234567890123456', // Invalid
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '123'
            };

            const result = await model.validateCard(cardData);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('INVALID_CARD_NUMBER');
        });

        it('should reject expired card', async () => {
            const cardData = {
                number: '4532015112830366',
                expiryMonth: 1,
                expiryYear: 2020, // Past year
                cvv: '123'
            };

            const result = await model.validateCard(cardData);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('CARD_EXPIRED');
        });

        it('should reject card expiring this month (past)', async () => {
            const now = new Date();
            const cardData = {
                number: '4532015112830366',
                expiryMonth: now.getMonth(), // Previous month
                expiryYear: now.getFullYear(),
                cvv: '123'
            };

            const result = await model.validateCard(cardData);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('CARD_EXPIRED');
        });

        it('should reject invalid CVV (too short)', async () => {
            const cardData = {
                number: '4532015112830366',
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '12' // Too short
            };

            const result = await model.validateCard(cardData);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('INVALID_CVV');
        });

        it('should reject invalid CVV (too long)', async () => {
            const cardData = {
                number: '4532015112830366',
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '12345' // Too long
            };

            const result = await model.validateCard(cardData);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('INVALID_CVV');
        });

        it('should accept 4-digit CVV (Amex)', async () => {
            const cardData = {
                number: '4532015112830366',
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '1234'
            };

            const result = await model.validateCard(cardData);

            expect(result.valid).toBe(true);
        });

        it('should reject non-numeric CVV', async () => {
            const cardData = {
                number: '4532015112830366',
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: 'abc'
            };

            const result = await model.validateCard(cardData);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('INVALID_CVV');
        });
    });

    describe('tokenize', () => {
        it('should tokenize valid card data', async () => {
            const cardData = {
                number: '4532015112830366',
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '123',
                holderName: 'John Doe'
            };

            const result = await model.tokenize(cardData);

            expect(result.success).toBe(true);
            expect(result.token).toBeDefined();
            expect(result.token).toMatch(/^tok_/);
            expect(result.brand).toBe('visa');
            expect(result.last4).toBe('0366');
        });

        it('should fail tokenization for invalid card', async () => {
            const cardData = {
                number: '1234567890123456',
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '123',
                holderName: 'John Doe'
            };

            const result = await model.tokenize(cardData);

            expect(result.success).toBe(false);
            expect(result.error).toBe('INVALID_CARD_NUMBER');
        });

        it('should detect Visa brand', async () => {
            const cardData = {
                number: '4532015112830366', // Visa
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '123',
                holderName: 'John Doe'
            };

            const result = await model.tokenize(cardData);

            expect(result.brand).toBe('visa');
        });

        it('should detect MasterCard brand', async () => {
            const cardData = {
                number: '5425233430109903', // MasterCard
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '123',
                holderName: 'John Doe'
            };

            const result = await model.tokenize(cardData);

            expect(result.brand).toBe('mastercard');
        });

        it('should handle tokenization errors', async () => {
            const cardData = {
                number: '4532015112830366',
                expiryMonth: 1,
                expiryYear: 2020, // Expired
                cvv: '123',
                holderName: 'John Doe'
            };

            const result = await model.tokenize(cardData);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('checkExpiration', () => {
        it('should return not expired for valid payment method', async () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            mockDb.query.paymentMethods.findFirst.mockResolvedValue({
                id: 'pm-1',
                expiresAt: futureDate
            });

            const result = await model.checkExpiration('pm-1');

            expect(result.expired).toBe(false);
            expect(result.expiresAt).toBeDefined();
        });

        it('should return expired for past expiry date', async () => {
            const pastDate = new Date();
            pastDate.setFullYear(pastDate.getFullYear() - 1);

            mockDb.query.paymentMethods.findFirst.mockResolvedValue({
                id: 'pm-1',
                expiresAt: pastDate
            });

            const result = await model.checkExpiration('pm-1');

            expect(result.expired).toBe(true);
        });

        it('should handle payment method without expiry date', async () => {
            mockDb.query.paymentMethods.findFirst.mockResolvedValue({
                id: 'pm-1',
                expiresAt: null
            });

            const result = await model.checkExpiration('pm-1');

            expect(result.expired).toBe(false);
        });

        it('should handle non-existent payment method', async () => {
            mockDb.query.paymentMethods.findFirst.mockResolvedValue(null);

            const result = await model.checkExpiration('non-existent');

            expect(result.expired).toBe(false);
        });

        it('should handle database errors', async () => {
            mockDb.query.paymentMethods.findFirst.mockRejectedValue(new Error('DB Error'));

            const result = await model.checkExpiration('pm-1');

            expect(result.expired).toBe(false);
        });
    });

    describe('setAsDefault', () => {
        it('should set payment method as default', async () => {
            const mockPaymentMethod = {
                id: 'pm-1',
                clientId: 'client-1'
            };

            mockDb.query.paymentMethods.findFirst.mockResolvedValue(mockPaymentMethod);
            mockDb.transaction.mockImplementation(async (callback: any) => {
                await callback(mockDb);
            });

            const result = await model.setAsDefault('pm-1');

            expect(result.success).toBe(true);
            expect(mockDb.transaction).toHaveBeenCalled();
        });

        it('should fail if payment method not found', async () => {
            mockDb.query.paymentMethods.findFirst.mockResolvedValue(null);

            const result = await model.setAsDefault('non-existent');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Payment method not found');
        });

        it('should handle transaction errors', async () => {
            const mockPaymentMethod = { id: 'pm-1', clientId: 'client-1' };
            mockDb.query.paymentMethods.findFirst.mockResolvedValue(mockPaymentMethod);
            mockDb.transaction.mockRejectedValue(new Error('Transaction failed'));

            const result = await model.setAsDefault('pm-1');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to set as default');
        });
    });

    describe('findByClient', () => {
        it('should find all payment methods for client', async () => {
            const mockPaymentMethods = [
                { id: 'pm-1', clientId: 'client-1', defaultMethod: true },
                { id: 'pm-2', clientId: 'client-1', defaultMethod: false }
            ];

            mockDb.query.paymentMethods.findMany.mockResolvedValue(mockPaymentMethods);

            const result = await model.findByClient('client-1');

            expect(result).toHaveLength(2);
            expect(result[0]?.defaultMethod).toBe(true);
        });

        it('should return empty array if no payment methods', async () => {
            mockDb.query.paymentMethods.findMany.mockResolvedValue([]);

            const result = await model.findByClient('client-1');

            expect(result).toHaveLength(0);
        });
    });

    describe('getDefaultForClient', () => {
        it('should return default payment method', async () => {
            const mockDefault = {
                id: 'pm-1',
                clientId: 'client-1',
                defaultMethod: true
            };

            mockDb.query.paymentMethods.findFirst.mockResolvedValue(mockDefault);

            const result = await model.getDefaultForClient('client-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('pm-1');
            expect(result?.defaultMethod).toBe(true);
        });

        it('should return null if no default method', async () => {
            mockDb.query.paymentMethods.findFirst.mockResolvedValue(null);

            const result = await model.getDefaultForClient('client-1');

            expect(result).toBeNull();
        });
    });

    describe('findExpired', () => {
        it('should find expired payment methods', async () => {
            const mockExpired = [
                { id: 'pm-1', expiresAt: new Date('2020-01-01') },
                { id: 'pm-2', expiresAt: new Date('2019-12-31') }
            ];

            mockDb.query.paymentMethods.findMany.mockResolvedValue(mockExpired);

            const result = await model.findExpired();

            expect(result).toHaveLength(2);
        });

        it('should return empty array if no expired methods', async () => {
            mockDb.query.paymentMethods.findMany.mockResolvedValue([]);

            const result = await model.findExpired();

            expect(result).toHaveLength(0);
        });
    });

    describe('createWithCard', () => {
        it('should create payment method with valid card', async () => {
            const mockCreated = {
                id: 'pm-1',
                clientId: 'client-1',
                token: 'tok_test',
                brand: 'visa',
                last4: '0366'
            };

            vi.spyOn(model, 'create').mockResolvedValue(mockCreated as any);

            const result = await model.createWithCard({
                clientId: 'client-1',
                provider: 'stripe',
                cardNumber: '4532015112830366',
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '123',
                holderName: 'John Doe'
            });

            expect(result.success).toBe(true);
            expect(result.paymentMethod?.id).toBe('pm-1');
        });

        it('should fail with invalid card', async () => {
            const result = await model.createWithCard({
                clientId: 'client-1',
                provider: 'stripe',
                cardNumber: '1234567890123456', // Invalid
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '123',
                holderName: 'John Doe'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should set as default when requested', async () => {
            const mockCreated = { id: 'pm-1', clientId: 'client-1' };

            vi.spyOn(model, 'create').mockResolvedValue(mockCreated as any);
            vi.spyOn(model, 'setAsDefault').mockResolvedValue({ success: true });

            const result = await model.createWithCard({
                clientId: 'client-1',
                provider: 'stripe',
                cardNumber: '4532015112830366',
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '123',
                holderName: 'John Doe',
                setAsDefault: true
            });

            expect(result.success).toBe(true);
            expect(model.setAsDefault).toHaveBeenCalledWith('pm-1');
        });

        it('should handle creation errors', async () => {
            vi.spyOn(model, 'create').mockRejectedValue(new Error('DB Error'));

            const result = await model.createWithCard({
                clientId: 'client-1',
                provider: 'stripe',
                cardNumber: '4532015112830366',
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '123',
                holderName: 'John Doe'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to create payment method');
        });
    });

    describe('remove', () => {
        it('should soft delete payment method', async () => {
            const mockPaymentMethod = {
                id: 'pm-1',
                clientId: 'client-1',
                defaultMethod: false
            };

            mockDb.query.paymentMethods.findFirst.mockResolvedValue(mockPaymentMethod);
            vi.spyOn(model, 'softDelete').mockResolvedValue();

            const result = await model.remove('pm-1');

            expect(result.success).toBe(true);
            expect(model.softDelete).toHaveBeenCalledWith({ id: 'pm-1' });
        });

        it('should set new default if removing default method', async () => {
            const mockDefault = {
                id: 'pm-1',
                clientId: 'client-1',
                defaultMethod: true
            };
            const mockOtherMethods = [{ id: 'pm-2', clientId: 'client-1' }];

            mockDb.query.paymentMethods.findFirst.mockResolvedValue(mockDefault);
            vi.spyOn(model, 'softDelete').mockResolvedValue();
            vi.spyOn(model, 'findByClient').mockResolvedValue(mockOtherMethods as any);
            vi.spyOn(model, 'setAsDefault').mockResolvedValue({ success: true });

            const result = await model.remove('pm-1');

            expect(result.success).toBe(true);
            expect(model.setAsDefault).toHaveBeenCalledWith('pm-2');
        });

        it('should fail if payment method not found', async () => {
            mockDb.query.paymentMethods.findFirst.mockResolvedValue(null);

            const result = await model.remove('non-existent');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Payment method not found');
        });

        it('should handle deletion errors', async () => {
            const mockPaymentMethod = { id: 'pm-1', clientId: 'client-1' };
            mockDb.query.paymentMethods.findFirst.mockResolvedValue(mockPaymentMethod);
            vi.spyOn(model, 'softDelete').mockRejectedValue(new Error('DB Error'));

            const result = await model.remove('pm-1');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to remove payment method');
        });
    });

    describe('updateExpiry', () => {
        it('should update expiry date successfully', async () => {
            const mockUpdated = {
                id: 'pm-1',
                expiresAt: new Date(2025, 11, 31) // Dec 31, 2025
            };

            // Mock needs to return proper chain and iterable result
            const mockReturning = vi.fn().mockResolvedValue([mockUpdated]);
            mockDb.update.mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: mockReturning
                    })
                })
            });

            const result = await model.updateExpiry('pm-1', 12, 2025);

            expect(result).toBeDefined();
            expect(result?.id).toBe('pm-1');
        });

        it('should return null if payment method not found', async () => {
            // Mock needs to return proper chain and iterable result
            const mockReturning = vi.fn().mockResolvedValue([]);
            mockDb.update.mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: mockReturning
                    })
                })
            });

            const result = await model.updateExpiry('non-existent', 12, 2025);

            expect(result).toBeNull();
        });

        it('should throw error on database failure', async () => {
            mockDb.update().set().where().returning.mockRejectedValue(new Error('DB Error'));

            await expect(model.updateExpiry('pm-1', 12, 2025)).rejects.toThrow(
                'Failed to update expiry'
            );
        });
    });

    describe('Card validation helpers', () => {
        it('should validate card numbers with spaces', async () => {
            const cardData = {
                number: '4532 0151 1283 0366', // With spaces
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '123'
            };

            const result = await model.validateCard(cardData);

            expect(result.valid).toBe(true);
        });

        it('should reject cards that are too short', async () => {
            const cardData = {
                number: '123456789012', // 12 digits
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '123'
            };

            const result = await model.validateCard(cardData);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('INVALID_CARD_NUMBER');
        });

        it('should reject cards that are too long', async () => {
            const cardData = {
                number: '12345678901234567890', // 20 digits
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '123'
            };

            const result = await model.validateCard(cardData);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('INVALID_CARD_NUMBER');
        });

        it('should detect American Express brand', async () => {
            const cardData = {
                number: '378282246310005', // Amex
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '1234',
                holderName: 'John Doe'
            };

            const result = await model.tokenize(cardData);

            expect(result.brand).toBe('amex');
        });

        it('should detect Discover brand', async () => {
            const cardData = {
                number: '6011111111111117', // Discover
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '123',
                holderName: 'John Doe'
            };

            const result = await model.tokenize(cardData);

            expect(result.brand).toBe('discover');
        });

        it('should return unknown for unrecognized brands', async () => {
            const cardData = {
                number: '9999999999999995', // Unknown (but valid Luhn)
                expiryMonth: 12,
                expiryYear: 2025,
                cvv: '123',
                holderName: 'John Doe'
            };

            const result = await model.tokenize(cardData);

            expect(result.brand).toBe('unknown');
        });
    });
});
