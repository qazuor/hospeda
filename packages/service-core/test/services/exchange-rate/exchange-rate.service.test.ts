import { ExchangeRateModel } from '@repo/db';
import type { ExchangeRate, ExchangeRateCreateInput } from '@repo/schemas';
import {
    ExchangeRateSourceEnum,
    ExchangeRateTypeEnum,
    PermissionEnum,
    PriceCurrencyEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExchangeRateService } from '../../../src/services/exchange-rate/exchange-rate.service.js';
import type { Actor, ServiceContext } from '../../../src/types/index.js';

describe('ExchangeRateService', () => {
    let service: ExchangeRateService;
    let mockModel: ExchangeRateModel;
    let mockActor: Actor;
    let ctx: ServiceContext;

    beforeEach(() => {
        // Mock context
        ctx = {
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn()
            } as unknown as ServiceContext['logger']
        };

        // Mock actor with all permissions
        mockActor = {
            id: 'test-actor-id',
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.EXCHANGE_RATE_VIEW,
                PermissionEnum.EXCHANGE_RATE_CREATE,
                PermissionEnum.EXCHANGE_RATE_UPDATE,
                PermissionEnum.EXCHANGE_RATE_DELETE
            ]
        };

        // Mock model
        mockModel = new ExchangeRateModel();

        // Create service with mocked model
        service = new ExchangeRateService(ctx, mockModel);
    });

    describe('create', () => {
        it('should create an exchange rate with valid data', async () => {
            const createData: ExchangeRateCreateInput = {
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1500,
                inverseRate: 0.0006666667,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                expiresAt: null
            };

            const expectedRate: ExchangeRate = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                ...createData,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            vi.spyOn(mockModel, 'create').mockResolvedValue(expectedRate);

            const result = await service.create(mockActor, createData);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data.fromCurrency).toBe(PriceCurrencyEnum.USD);
                expect(result.data.toCurrency).toBe(PriceCurrencyEnum.ARS);
                expect(result.data.rate).toBe(1500);
            }
        });

        it('should reject same currency pair', async () => {
            const invalidData: ExchangeRateCreateInput = {
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.USD, // Same as fromCurrency
                rate: 1,
                inverseRate: 1,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                expiresAt: null
            };

            const result = await service.create(mockActor, invalidData);

            expect(result.error).toBeDefined();
            expect(result.data).toBeUndefined();
            if (result.error) {
                expect(result.error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            }
        });

        it('should check CREATE permission', async () => {
            const actorWithoutPermission: Actor = {
                id: 'test-actor-id',
                role: RoleEnum.USER,
                permissions: []
            };

            const createData: ExchangeRateCreateInput = {
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1500,
                inverseRate: 0.0006666667,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                expiresAt: null
            };

            const result = await service.create(actorWithoutPermission, createData);

            expect(result.error).toBeDefined();
            expect(result.data).toBeUndefined();
            if (result.error) {
                expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
    });

    describe('getLatestRate', () => {
        it('should return the latest rate for a currency pair', async () => {
            const mockRate: ExchangeRate = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1500,
                inverseRate: 0.0006666667,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                expiresAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            vi.spyOn(mockModel, 'findAll').mockResolvedValue({
                items: [mockRate],
                total: 1
            });

            const result = await service.getLatestRate(mockActor, {
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rateType: ExchangeRateTypeEnum.OFICIAL
            });

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data.fromCurrency).toBe(PriceCurrencyEnum.USD);
                expect(result.data.rate).toBe(1500);
            }
        });

        it('should return null if no rate found', async () => {
            vi.spyOn(mockModel, 'findAll').mockResolvedValue({
                items: [],
                total: 0
            });

            const result = await service.getLatestRate(mockActor, {
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS
            });

            expect(result.data).toBeNull();
            expect(result.error).toBeUndefined();
        });
    });

    describe('createManualOverride', () => {
        it('should create a manual override rate', async () => {
            const createData: ExchangeRateCreateInput = {
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1600,
                inverseRate: 0.000625,
                rateType: ExchangeRateTypeEnum.STANDARD,
                source: ExchangeRateSourceEnum.DOLARAPI, // Will be overridden
                isManualOverride: false, // Will be overridden
                fetchedAt: new Date(),
                expiresAt: null
            };

            const expectedRate: ExchangeRate = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1600,
                inverseRate: 0.000625,
                rateType: ExchangeRateTypeEnum.STANDARD,
                source: ExchangeRateSourceEnum.MANUAL,
                isManualOverride: true,
                fetchedAt: expect.any(Date),
                expiresAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            vi.spyOn(mockModel, 'create').mockResolvedValue(expectedRate);

            const result = await service.createManualOverride(mockActor, createData);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data.source).toBe(ExchangeRateSourceEnum.MANUAL);
                expect(result.data.isManualOverride).toBe(true);
            }
        });
    });

    describe('removeManualOverride', () => {
        it('should remove a manual override rate', async () => {
            const manualRate: ExchangeRate = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1600,
                inverseRate: 0.000625,
                rateType: ExchangeRateTypeEnum.STANDARD,
                source: ExchangeRateSourceEnum.MANUAL,
                isManualOverride: true,
                fetchedAt: new Date(),
                expiresAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            vi.spyOn(mockModel, 'findById').mockResolvedValue(manualRate);
            vi.spyOn(mockModel, 'hardDelete').mockResolvedValue(1);

            const result = await service.removeManualOverride(mockActor, {
                id: '550e8400-e29b-41d4-a716-446655440000'
            });

            expect(result.error).toBeUndefined();
        });

        it('should reject removing non-manual rates', async () => {
            const nonManualRate: ExchangeRate = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1500,
                inverseRate: 0.0006666667,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                expiresAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            vi.spyOn(mockModel, 'findById').mockResolvedValue(nonManualRate);

            const result = await service.removeManualOverride(mockActor, {
                id: '550e8400-e29b-41d4-a716-446655440000'
            });

            expect(result.error).toBeDefined();
            expect(result.data).toBeUndefined();
            if (result.error) {
                expect(result.error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            }
        });

        it('should throw NOT_FOUND if rate does not exist', async () => {
            vi.spyOn(mockModel, 'findById').mockResolvedValue(null);

            const result = await service.removeManualOverride(mockActor, {
                id: '550e8400-e29b-41d4-a716-446655440001'
            });

            expect(result.error).toBeDefined();
            expect(result.data).toBeUndefined();
            if (result.error) {
                expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        });
    });

    describe('search', () => {
        it('should search exchange rates with filters', async () => {
            const mockRates: ExchangeRate[] = [
                {
                    id: 'rate-1',
                    fromCurrency: PriceCurrencyEnum.USD,
                    toCurrency: PriceCurrencyEnum.ARS,
                    rate: 1500,
                    inverseRate: 0.0006666667,
                    rateType: ExchangeRateTypeEnum.OFICIAL,
                    source: ExchangeRateSourceEnum.DOLARAPI,
                    isManualOverride: false,
                    fetchedAt: new Date(),
                    expiresAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];

            vi.spyOn(mockModel, 'findAll').mockResolvedValue({
                items: mockRates,
                total: 1
            });

            const result = await service.search(mockActor, {
                fromCurrency: PriceCurrencyEnum.USD,
                rateType: ExchangeRateTypeEnum.OFICIAL
            });

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data.items).toHaveLength(1);
                expect(result.data.items[0]?.fromCurrency).toBe(PriceCurrencyEnum.USD);
            }
        });
    });

    describe('count', () => {
        it('should count exchange rates', async () => {
            vi.spyOn(mockModel, 'count').mockResolvedValue(42);

            const result = await service.count(mockActor, {});

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data.count).toBe(42);
            }
        });
    });
});
