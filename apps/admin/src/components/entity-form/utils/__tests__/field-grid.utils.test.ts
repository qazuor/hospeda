import { describe, expect, it } from 'vitest';
import { FieldTypeEnum } from '../../enums/form-config.enums';
import { getFieldColSpanClass, isFullWidthField } from '../field-grid.utils';

// ---------------------------------------------------------------------------
// Tests: getFieldColSpanClass
// ---------------------------------------------------------------------------

describe('getFieldColSpanClass', () => {
    describe('full-width types (col-span-2)', () => {
        const fullWidthTypes: FieldTypeEnum[] = [
            FieldTypeEnum.TEXTAREA,
            FieldTypeEnum.RICH_TEXT,
            FieldTypeEnum.COORDINATES,
            FieldTypeEnum.GALLERY,
            FieldTypeEnum.IMAGE,
            FieldTypeEnum.FILE,
            FieldTypeEnum.JSON,
            // Added in commit f572ecdea: catalog chip selects need full width for chip wrapping.
            FieldTypeEnum.AMENITY_SELECT,
            FieldTypeEnum.FEATURE_SELECT
        ];

        for (const type of fullWidthTypes) {
            it(`returns "col-span-2" for ${type}`, () => {
                expect(getFieldColSpanClass(type)).toBe('col-span-2');
            });
        }
    });

    describe('half-width types (col-span-1)', () => {
        const halfWidthTypes: FieldTypeEnum[] = [
            FieldTypeEnum.TEXT,
            FieldTypeEnum.NUMBER,
            FieldTypeEnum.EMAIL,
            FieldTypeEnum.URL,
            FieldTypeEnum.PHONE,
            FieldTypeEnum.DATE,
            FieldTypeEnum.TIME,
            FieldTypeEnum.SELECT,
            FieldTypeEnum.SWITCH,
            FieldTypeEnum.CHECKBOX,
            FieldTypeEnum.CURRENCY,
            FieldTypeEnum.DESTINATION_SELECT,
            FieldTypeEnum.USER_SELECT,
            FieldTypeEnum.ACCOMMODATION_SELECT,
            FieldTypeEnum.EVENT_SELECT,
            FieldTypeEnum.ENTITY_SELECT,
            FieldTypeEnum.TAG_SELECT
        ];

        for (const type of halfWidthTypes) {
            it(`returns "col-span-1" for ${type}`, () => {
                expect(getFieldColSpanClass(type)).toBe('col-span-1');
            });
        }
    });
});

// ---------------------------------------------------------------------------
// Tests: isFullWidthField
// ---------------------------------------------------------------------------

describe('isFullWidthField', () => {
    it('returns true for TEXTAREA', () => {
        expect(isFullWidthField(FieldTypeEnum.TEXTAREA)).toBe(true);
    });

    it('returns true for GALLERY', () => {
        expect(isFullWidthField(FieldTypeEnum.GALLERY)).toBe(true);
    });

    it('returns false for TEXT', () => {
        expect(isFullWidthField(FieldTypeEnum.TEXT)).toBe(false);
    });

    it('returns false for SELECT', () => {
        expect(isFullWidthField(FieldTypeEnum.SELECT)).toBe(false);
    });
});
