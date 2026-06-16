import { describe, expect, it } from 'vitest';
import { HostTradeCategoryEnum } from '../host-trade-category.enum.js';
import { HostTradeCategoryEnumSchema } from '../host-trade-category.schema.js';

// ============================================================================
// HostTradeCategoryEnum
// ============================================================================

describe('HostTradeCategoryEnum', () => {
    it('should have exactly 13 category values', () => {
        const values = Object.values(HostTradeCategoryEnum);
        expect(values).toHaveLength(13);
    });

    it('should include all expected categories', () => {
        expect(HostTradeCategoryEnum.CERRAJERIA).toBe('CERRAJERIA');
        expect(HostTradeCategoryEnum.PLOMERIA).toBe('PLOMERIA');
        expect(HostTradeCategoryEnum.ELECTRICIDAD).toBe('ELECTRICIDAD');
        expect(HostTradeCategoryEnum.GAS).toBe('GAS');
        expect(HostTradeCategoryEnum.CLIMATIZACION).toBe('CLIMATIZACION');
        expect(HostTradeCategoryEnum.LIMPIEZA).toBe('LIMPIEZA');
        expect(HostTradeCategoryEnum.FLETES).toBe('FLETES');
        expect(HostTradeCategoryEnum.VIDRIERIA).toBe('VIDRIERIA');
        expect(HostTradeCategoryEnum.CARPINTERIA).toBe('CARPINTERIA');
        expect(HostTradeCategoryEnum.PILETA_JARDIN).toBe('PILETA_JARDIN');
        expect(HostTradeCategoryEnum.PLAGAS).toBe('PLAGAS');
        expect(HostTradeCategoryEnum.INTERNET).toBe('INTERNET');
        expect(HostTradeCategoryEnum.ALBANILERIA).toBe('ALBANILERIA');
    });

    it('should use SCREAMING_SNAKE_CASE for every value', () => {
        for (const value of Object.values(HostTradeCategoryEnum)) {
            expect(value).toMatch(/^[A-Z]+(?:_[A-Z]+)*$/);
        }
    });

    describe('HostTradeCategoryEnumSchema', () => {
        it('should accept every valid category value', () => {
            for (const value of Object.values(HostTradeCategoryEnum)) {
                const result = HostTradeCategoryEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should reject an invalid category value', () => {
            const result = HostTradeCategoryEnumSchema.safeParse('PELUQUERIA');
            expect(result.success).toBe(false);
        });

        it('should return the correct error message key for an invalid value', () => {
            const result = HostTradeCategoryEnumSchema.safeParse('INVALID');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toBe(
                    'zodError.enums.hostTradeCategory.invalid'
                );
            }
        });
    });
});
