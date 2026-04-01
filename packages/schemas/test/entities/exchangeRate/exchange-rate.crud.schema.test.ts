import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    ExchangeRateConvertInputSchema,
    ExchangeRateConvertOutputSchema,
    ExchangeRateCreateInputSchema,
    ExchangeRateCreateOutputSchema,
    ExchangeRateDeleteInputSchema,
    ExchangeRateDeleteOutputSchema,
    ExchangeRateRestoreInputSchema,
    ExchangeRateRestoreOutputSchema,
    ExchangeRateSearchInputSchema,
    ExchangeRateUpdateInputSchema,
    ExchangeRateUpdateOutputSchema
} from '../../../src/entities/exchangeRate/exchange-rate.crud.schema.js';
import { PriceCurrencyEnum } from '../../../src/enums/currency.enum.js';
import { ExchangeRateSourceEnum } from '../../../src/enums/exchange-rate-source.enum.js';
import { ExchangeRateTypeEnum } from '../../../src/enums/exchange-rate-type.enum.js';

describe('ExchangeRate CRUD Schemas', () => {
    describe('ExchangeRateCreateInputSchema', () => {
        it('should validate valid create input', () => {
            const validInput = {
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1050.5,
                inverseRate: 0.00095,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.MANUAL,
                isManualOverride: false,
                fetchedAt: new Date()
            };

            expect(() => ExchangeRateCreateInputSchema.parse(validInput)).not.toThrow();

            const result = ExchangeRateCreateInputSchema.parse(validInput);
            expect(result.fromCurrency).toBe(PriceCurrencyEnum.USD);
            expect(result.toCurrency).toBe(PriceCurrencyEnum.ARS);
            expect(result.rate).toBe(1050.5);
        });

        it('should reject create input with auto-generated fields', () => {
            const invalidInput = {
                id: 'auto-generated-id',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1050.5,
                inverseRate: 0.00095,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.MANUAL,
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateCreateInputSchema.strict().parse(invalidInput)).toThrow(
                ZodError
            );
        });

        it('should require all mandatory fields', () => {
            const incompleteInput = {
                fromCurrency: PriceCurrencyEnum.USD
                // Missing required fields
            };

            expect(() => ExchangeRateCreateInputSchema.parse(incompleteInput)).toThrow(ZodError);
        });

        it('should reject negative rates', () => {
            const invalidInput = {
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: -100,
                inverseRate: 0.00095,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.MANUAL,
                isManualOverride: false,
                fetchedAt: new Date()
            };

            expect(() => ExchangeRateCreateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should accept optional expiresAt field', () => {
            const validInput = {
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1050.5,
                inverseRate: 0.00095,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.MANUAL,
                isManualOverride: false,
                fetchedAt: new Date(),
                expiresAt: new Date(Date.now() + 86400000) // +1 day
            };

            expect(() => ExchangeRateCreateInputSchema.parse(validInput)).not.toThrow();
        });
    });

    describe('ExchangeRateCreateOutputSchema', () => {
        it('should validate valid create output', () => {
            const validOutput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1050.5,
                inverseRate: 0.00095,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.MANUAL,
                isManualOverride: false,
                fetchedAt: new Date(),
                expiresAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateCreateOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should require all exchange rate fields in output', () => {
            const incompleteOutput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                fromCurrency: PriceCurrencyEnum.USD
                // Missing many required fields
            };

            expect(() => ExchangeRateCreateOutputSchema.parse(incompleteOutput)).toThrow(ZodError);
        });
    });

    describe('ExchangeRateUpdateInputSchema', () => {
        it('should validate valid update input', () => {
            const validInput = {
                rate: 1100,
                inverseRate: 0.00091,
                isManualOverride: true
            };

            expect(() => ExchangeRateUpdateInputSchema.parse(validInput)).not.toThrow();
        });

        it('should accept partial updates', () => {
            const partialInput = {
                rate: 1200
            };

            expect(() => ExchangeRateUpdateInputSchema.parse(partialInput)).not.toThrow();
        });

        it('should reject invalid field values', () => {
            const invalidInput = {
                rate: -500 // Negative rate
            };

            expect(() => ExchangeRateUpdateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should allow updating source and rateType', () => {
            const updateInput = {
                source: ExchangeRateSourceEnum.EXCHANGERATE_API,
                rateType: ExchangeRateTypeEnum.BLUE
            };

            expect(() => ExchangeRateUpdateInputSchema.parse(updateInput)).not.toThrow();
        });

        it('should allow empty update object', () => {
            const emptyUpdate = {};

            expect(() => ExchangeRateUpdateInputSchema.parse(emptyUpdate)).not.toThrow();
        });
    });

    describe('ExchangeRateUpdateOutputSchema', () => {
        it('should validate valid update output', () => {
            const validOutput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1100,
                inverseRate: 0.00091,
                rateType: ExchangeRateTypeEnum.BLUE,
                source: ExchangeRateSourceEnum.MANUAL,
                isManualOverride: true,
                fetchedAt: new Date(),
                expiresAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateUpdateOutputSchema.parse(validOutput)).not.toThrow();
        });
    });

    describe('ExchangeRateDeleteInputSchema', () => {
        it('should validate valid delete input', () => {
            const validInput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                force: false
            };

            expect(() => ExchangeRateDeleteInputSchema.parse(validInput)).not.toThrow();
        });

        it('should reject invalid delete input', () => {
            const invalidInput = {
                id: 'invalid-uuid'
            };

            expect(() => ExchangeRateDeleteInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should default force to false', () => {
            const input = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
            };

            const result = ExchangeRateDeleteInputSchema.parse(input);
            expect(result.force).toBe(false);
        });
    });

    describe('ExchangeRateDeleteOutputSchema', () => {
        it('should validate valid delete output', () => {
            const validOutput = {
                success: true,
                deletedAt: new Date()
            };

            expect(() => ExchangeRateDeleteOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should default success to true', () => {
            const output = {};

            const result = ExchangeRateDeleteOutputSchema.parse(output);
            expect(result.success).toBe(true);
        });

        it('should accept delete output without deletedAt', () => {
            const output = {
                success: true
            };

            expect(() => ExchangeRateDeleteOutputSchema.parse(output)).not.toThrow();
        });
    });

    describe('ExchangeRateRestoreInputSchema', () => {
        it('should validate valid restore input', () => {
            const validInput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
            };

            expect(() => ExchangeRateRestoreInputSchema.parse(validInput)).not.toThrow();
        });

        it('should reject invalid restore input', () => {
            const invalidInput = {
                id: 'not-a-uuid'
            };

            expect(() => ExchangeRateRestoreInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('ExchangeRateRestoreOutputSchema', () => {
        it('should validate valid restore output', () => {
            const validOutput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1050.5,
                inverseRate: 0.00095,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.MANUAL,
                isManualOverride: false,
                fetchedAt: new Date(),
                expiresAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateRestoreOutputSchema.parse(validOutput)).not.toThrow();
        });
    });

    describe('ExchangeRateSearchInputSchema', () => {
        it('should validate valid search input with all filters', () => {
            const validInput = {
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rateType: ExchangeRateTypeEnum.BLUE,
                source: ExchangeRateSourceEnum.EXCHANGERATE_API,
                isManualOverride: true
            };

            expect(() => ExchangeRateSearchInputSchema.parse(validInput)).not.toThrow();
        });

        it('should accept empty search filters', () => {
            const emptyFilters = {};

            expect(() => ExchangeRateSearchInputSchema.parse(emptyFilters)).not.toThrow();
        });

        it('should accept partial search filters', () => {
            const partialFilters = {
                fromCurrency: PriceCurrencyEnum.USD,
                rateType: ExchangeRateTypeEnum.OFICIAL
            };

            expect(() => ExchangeRateSearchInputSchema.parse(partialFilters)).not.toThrow();
        });

        it('should validate only manual overrides filter', () => {
            const manualOnlyFilter = {
                isManualOverride: true
            };

            expect(() => ExchangeRateSearchInputSchema.parse(manualOnlyFilter)).not.toThrow();
        });
    });

    describe('ExchangeRateConvertInputSchema', () => {
        it('should validate valid convert input', () => {
            const validInput = {
                from: PriceCurrencyEnum.USD,
                to: PriceCurrencyEnum.ARS,
                amount: 100
            };

            expect(() => ExchangeRateConvertInputSchema.parse(validInput)).not.toThrow();
        });

        it('should reject zero amount', () => {
            const invalidInput = {
                from: PriceCurrencyEnum.USD,
                to: PriceCurrencyEnum.ARS,
                amount: 0
            };

            expect(() => ExchangeRateConvertInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject negative amount', () => {
            const invalidInput = {
                from: PriceCurrencyEnum.USD,
                to: PriceCurrencyEnum.ARS,
                amount: -100
            };

            expect(() => ExchangeRateConvertInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should accept optional rateType', () => {
            const inputWithRateType = {
                from: PriceCurrencyEnum.USD,
                to: PriceCurrencyEnum.ARS,
                amount: 100,
                rateType: ExchangeRateTypeEnum.BLUE
            };

            expect(() => ExchangeRateConvertInputSchema.parse(inputWithRateType)).not.toThrow();
        });

        it('should require from, to, and amount fields', () => {
            const incompleteInput = {
                from: PriceCurrencyEnum.USD
                // Missing to and amount
            };

            expect(() => ExchangeRateConvertInputSchema.parse(incompleteInput)).toThrow(ZodError);
        });
    });

    describe('ExchangeRateConvertOutputSchema', () => {
        it('should validate valid convert output', () => {
            const validOutput = {
                convertedAmount: 105050,
                rate: 1050.5,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.EXCHANGERATE_API,
                lastUpdated: new Date(),
                disclaimer: 'Rates are indicative and may vary'
            };

            expect(() => ExchangeRateConvertOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should accept output without disclaimer', () => {
            const outputWithoutDisclaimer = {
                convertedAmount: 105050,
                rate: 1050.5,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.EXCHANGERATE_API,
                lastUpdated: new Date()
            };

            expect(() =>
                ExchangeRateConvertOutputSchema.parse(outputWithoutDisclaimer)
            ).not.toThrow();
        });

        it('should require all mandatory fields', () => {
            const incompleteOutput = {
                convertedAmount: 105050
                // Missing required fields
            };

            expect(() => ExchangeRateConvertOutputSchema.parse(incompleteOutput)).toThrow(ZodError);
        });

        it('should reject negative rate', () => {
            const invalidOutput = {
                convertedAmount: 105050,
                rate: -1050.5,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.EXCHANGERATE_API,
                lastUpdated: new Date()
            };

            expect(() => ExchangeRateConvertOutputSchema.parse(invalidOutput)).toThrow(ZodError);
        });
    });

    describe('Integration Tests', () => {
        it('should work with realistic exchange rate workflow', () => {
            // Create input
            const createInput = {
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1050.5,
                inverseRate: 0.00095,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.EXCHANGERATE_API,
                isManualOverride: false,
                fetchedAt: new Date()
            };
            expect(() => ExchangeRateCreateInputSchema.parse(createInput)).not.toThrow();

            // Create output
            const createOutput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                ...createInput,
                expiresAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            expect(() => ExchangeRateCreateOutputSchema.parse(createOutput)).not.toThrow();

            // Update input
            const updateInput = { rate: 1100, isManualOverride: true };
            expect(() => ExchangeRateUpdateInputSchema.parse(updateInput)).not.toThrow();

            // Search
            const searchInput = {
                fromCurrency: PriceCurrencyEnum.USD,
                rateType: ExchangeRateTypeEnum.OFICIAL
            };
            expect(() => ExchangeRateSearchInputSchema.parse(searchInput)).not.toThrow();

            // Convert
            const convertInput = {
                from: PriceCurrencyEnum.USD,
                to: PriceCurrencyEnum.ARS,
                amount: 100
            };
            expect(() => ExchangeRateConvertInputSchema.parse(convertInput)).not.toThrow();

            // Convert output
            const convertOutput = {
                convertedAmount: 105050,
                rate: 1050.5,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.EXCHANGERATE_API,
                lastUpdated: new Date()
            };
            expect(() => ExchangeRateConvertOutputSchema.parse(convertOutput)).not.toThrow();
        });

        it('should validate complete CRUD lifecycle', () => {
            const rateId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

            // Create
            const createInput = {
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1000,
                inverseRate: 0.001,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.MANUAL,
                isManualOverride: false,
                fetchedAt: new Date()
            };
            const createResult = ExchangeRateCreateInputSchema.parse(createInput);
            expect(createResult).toBeDefined();

            // Update
            const updateInput = { rate: 1050 };
            const updateResult = ExchangeRateUpdateInputSchema.parse(updateInput);
            expect(updateResult).toBeDefined();

            // Delete
            const deleteInput = { id: rateId };
            const deleteResult = ExchangeRateDeleteInputSchema.parse(deleteInput);
            expect(deleteResult.force).toBe(false);

            // Restore
            const restoreInput = { id: rateId };
            const restoreResult = ExchangeRateRestoreInputSchema.parse(restoreInput);
            expect(restoreResult).toBeDefined();
        });
    });
});
