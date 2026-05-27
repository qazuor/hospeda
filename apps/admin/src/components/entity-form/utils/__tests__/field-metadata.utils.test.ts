import { describe, expect, it } from 'vitest';
import { FieldTypeEnum } from '../../enums/form-config.enums';
import type { FieldConfig } from '../../types/field-config.types';
import { extractListCount, extractMaxLength } from '../field-metadata.utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(type: FieldTypeEnum, typeConfig?: Record<string, unknown>): FieldConfig {
    return {
        id: 'test-field',
        type,
        typeConfig: typeConfig as FieldConfig['typeConfig']
    };
}

// ---------------------------------------------------------------------------
// extractMaxLength
// ---------------------------------------------------------------------------

describe('extractMaxLength', () => {
    it('returns maxLength from typeConfig for TEXT fields', () => {
        const config = makeConfig(FieldTypeEnum.TEXT, { maxLength: 100 });
        expect(extractMaxLength(config)).toBe(100);
    });

    it('returns maxLength from typeConfig for TEXTAREA fields', () => {
        const config = makeConfig(FieldTypeEnum.TEXTAREA, { maxLength: 300 });
        expect(extractMaxLength(config)).toBe(300);
    });

    it('returns maxLength from typeConfig for RICH_TEXT fields', () => {
        const config = makeConfig(FieldTypeEnum.RICH_TEXT, { type: 'RICH_TEXT', maxLength: 5000 });
        expect(extractMaxLength(config)).toBe(5000);
    });

    it('returns undefined when typeConfig has no maxLength', () => {
        const config = makeConfig(FieldTypeEnum.TEXT, {});
        expect(extractMaxLength(config)).toBeUndefined();
    });

    it('returns undefined when typeConfig is absent', () => {
        const config = makeConfig(FieldTypeEnum.TEXT);
        expect(extractMaxLength(config)).toBeUndefined();
    });

    it('returns undefined for non-text fields (SELECT)', () => {
        const config = makeConfig(FieldTypeEnum.SELECT, { options: [] });
        expect(extractMaxLength(config)).toBeUndefined();
    });

    it('returns undefined for non-text fields (NUMBER)', () => {
        const config = makeConfig(FieldTypeEnum.NUMBER, { min: 0, max: 100 });
        expect(extractMaxLength(config)).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// extractListCount
// ---------------------------------------------------------------------------

describe('extractListCount', () => {
    it('returns the array length for an array value', () => {
        expect(extractListCount(['a', 'b', 'c'])).toBe(3);
    });

    it('returns 0 for an empty array', () => {
        expect(extractListCount([])).toBe(0);
    });

    it('returns undefined for non-array value', () => {
        expect(extractListCount('string')).toBeUndefined();
        expect(extractListCount(42)).toBeUndefined();
        expect(extractListCount(null)).toBeUndefined();
        expect(extractListCount(undefined)).toBeUndefined();
        expect(extractListCount({})).toBeUndefined();
    });
});
