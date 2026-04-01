import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    ExchangeRateConfigGetOutputSchema,
    ExchangeRateConfigUpdateInputSchema,
    ExchangeRateConfigUpdateOutputSchema
} from '../../../src/entities/exchangeRate/exchange-rate-config.crud.schema.js';
import { ExchangeRateTypeEnum } from '../../../src/enums/exchange-rate-type.enum.js';

describe('ExchangeRateConfig CRUD Schemas', () => {
    // ============================================================================
    // GET SCHEMAS
    // ============================================================================

    describe('ExchangeRateConfigGetOutputSchema', () => {
        it('should validate valid config output', () => {
            const validOutput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                defaultRateType: 'oficial',
                dolarApiFetchIntervalMinutes: 15,
                exchangeRateApiFetchIntervalHours: 6,
                showConversionDisclaimer: true,
                disclaimerText: 'Conversion rates are approximate',
                enableAutoFetch: true,
                updatedAt: new Date(),
                updatedById: 'a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789'
            };

            expect(() => ExchangeRateConfigGetOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should validate config with nullable fields', () => {
            const outputWithNulls = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                defaultRateType: 'blue',
                dolarApiFetchIntervalMinutes: 30,
                exchangeRateApiFetchIntervalHours: 12,
                showConversionDisclaimer: false,
                disclaimerText: null,
                enableAutoFetch: false,
                updatedAt: new Date(),
                updatedById: null
            };

            expect(() => ExchangeRateConfigGetOutputSchema.parse(outputWithNulls)).not.toThrow();
        });

        it('should require all mandatory fields', () => {
            const incompleteOutput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                defaultRateType: 'oficial'
                // Missing required fields
            };

            expect(() => ExchangeRateConfigGetOutputSchema.parse(incompleteOutput)).toThrow(
                ZodError
            );
        });
    });

    // ============================================================================
    // UPDATE SCHEMAS
    // ============================================================================

    describe('ExchangeRateConfigUpdateInputSchema', () => {
        it('should validate valid update input with all fields', () => {
            const validInput = {
                defaultRateType: 'blue',
                dolarApiFetchIntervalMinutes: 30,
                exchangeRateApiFetchIntervalHours: 12,
                showConversionDisclaimer: false,
                disclaimerText: 'Updated disclaimer',
                enableAutoFetch: false
            };

            expect(() => ExchangeRateConfigUpdateInputSchema.parse(validInput)).not.toThrow();
        });

        it('should accept partial updates (only some fields)', () => {
            const partialInput = {
                defaultRateType: 'blue'
            };

            expect(() => ExchangeRateConfigUpdateInputSchema.parse(partialInput)).not.toThrow();
        });

        it('should accept empty object (all fields optional)', () => {
            const emptyInput = {};

            expect(() => ExchangeRateConfigUpdateInputSchema.parse(emptyInput)).not.toThrow();
        });

        it('should validate only fetch interval fields', () => {
            const intervalUpdate = {
                dolarApiFetchIntervalMinutes: 20,
                exchangeRateApiFetchIntervalHours: 8
            };

            expect(() => ExchangeRateConfigUpdateInputSchema.parse(intervalUpdate)).not.toThrow();
        });

        it('should validate only disclaimer fields', () => {
            const disclaimerUpdate = {
                showConversionDisclaimer: true,
                disclaimerText: 'New disclaimer text'
            };

            expect(() => ExchangeRateConfigUpdateInputSchema.parse(disclaimerUpdate)).not.toThrow();
        });

        it('should reject negative interval values', () => {
            const invalidInput = {
                dolarApiFetchIntervalMinutes: -10
            };

            expect(() => ExchangeRateConfigUpdateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject zero interval values', () => {
            const invalidInput = {
                exchangeRateApiFetchIntervalHours: 0
            };

            expect(() => ExchangeRateConfigUpdateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject non-integer interval values', () => {
            const invalidInput = {
                dolarApiFetchIntervalMinutes: 15.5
            };

            expect(() => ExchangeRateConfigUpdateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject invalid rate type enum values', () => {
            const invalidInput = {
                defaultRateType: 'invalid_rate_type'
            };

            expect(() => ExchangeRateConfigUpdateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should accept valid rate type enum values', () => {
            const validRateTypes = ['oficial', 'blue', 'mep', 'ccl', 'tarjeta', 'standard'];

            for (const rateType of validRateTypes) {
                const input = { defaultRateType: rateType };
                expect(() => ExchangeRateConfigUpdateInputSchema.parse(input)).not.toThrow();
            }
        });

        it('should reject boolean fields with non-boolean values', () => {
            const invalidInput = {
                showConversionDisclaimer: 'true' // String instead of boolean
            };

            expect(() => ExchangeRateConfigUpdateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should accept null for disclaimerText', () => {
            const inputWithNull = {
                disclaimerText: null
            };

            expect(() => ExchangeRateConfigUpdateInputSchema.parse(inputWithNull)).not.toThrow();
        });

        it('should not accept id field in update input', () => {
            const inputWithId = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                defaultRateType: 'blue'
            };

            expect(() => ExchangeRateConfigUpdateInputSchema.strict().parse(inputWithId)).toThrow(
                ZodError
            );
        });

        it('should not accept updatedAt field in update input', () => {
            const inputWithUpdatedAt = {
                defaultRateType: 'blue',
                updatedAt: new Date()
            };

            expect(() =>
                ExchangeRateConfigUpdateInputSchema.strict().parse(inputWithUpdatedAt)
            ).toThrow(ZodError);
        });

        it('should not accept updatedById field in update input', () => {
            const inputWithUpdatedById = {
                defaultRateType: 'blue',
                updatedById: 'a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789'
            };

            expect(() =>
                ExchangeRateConfigUpdateInputSchema.strict().parse(inputWithUpdatedById)
            ).toThrow(ZodError);
        });
    });

    describe('ExchangeRateConfigUpdateOutputSchema', () => {
        it('should validate valid update output', () => {
            const validOutput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                defaultRateType: 'blue',
                dolarApiFetchIntervalMinutes: 30,
                exchangeRateApiFetchIntervalHours: 12,
                showConversionDisclaimer: false,
                disclaimerText: 'Updated disclaimer',
                enableAutoFetch: false,
                updatedAt: new Date(),
                updatedById: 'a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789'
            };

            expect(() => ExchangeRateConfigUpdateOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should include all config fields in output', () => {
            const validOutput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                defaultRateType: 'oficial',
                dolarApiFetchIntervalMinutes: 15,
                exchangeRateApiFetchIntervalHours: 6,
                showConversionDisclaimer: true,
                disclaimerText: null,
                enableAutoFetch: true,
                updatedAt: new Date(),
                updatedById: null
            };

            const result = ExchangeRateConfigUpdateOutputSchema.parse(validOutput);

            expect(result.id).toBeDefined();
            expect(result.defaultRateType).toBeDefined();
            expect(result.dolarApiFetchIntervalMinutes).toBeDefined();
            expect(result.exchangeRateApiFetchIntervalHours).toBeDefined();
            expect(result.showConversionDisclaimer).toBeDefined();
            expect(result.enableAutoFetch).toBeDefined();
            expect(result.updatedAt).toBeDefined();
        });
    });

    // ============================================================================
    // TYPE INFERENCE TESTS
    // ============================================================================

    describe('Type Inference', () => {
        it('should correctly infer update input type', () => {
            const input: import(
                '../../../src/entities/exchangeRate/exchange-rate-config.crud.schema.js'
            ).ExchangeRateConfigUpdateInput = {
                defaultRateType: ExchangeRateTypeEnum.BLUE,
                dolarApiFetchIntervalMinutes: 20
            };

            expect(input).toBeDefined();
        });

        it('should correctly infer get output type', () => {
            const output: import(
                '../../../src/entities/exchangeRate/exchange-rate-config.crud.schema.js'
            ).ExchangeRateConfigGetOutput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                defaultRateType: ExchangeRateTypeEnum.OFICIAL,
                dolarApiFetchIntervalMinutes: 15,
                exchangeRateApiFetchIntervalHours: 6,
                showConversionDisclaimer: true,
                disclaimerText: null,
                enableAutoFetch: true,
                updatedAt: new Date(),
                updatedById: null
            };

            expect(output).toBeDefined();
        });

        it('should correctly infer update output type', () => {
            const output: import(
                '../../../src/entities/exchangeRate/exchange-rate-config.crud.schema.js'
            ).ExchangeRateConfigUpdateOutput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                defaultRateType: ExchangeRateTypeEnum.BLUE,
                dolarApiFetchIntervalMinutes: 30,
                exchangeRateApiFetchIntervalHours: 12,
                showConversionDisclaimer: false,
                disclaimerText: 'Updated',
                enableAutoFetch: false,
                updatedAt: new Date(),
                updatedById: 'a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789'
            };

            expect(output).toBeDefined();
        });
    });
});
