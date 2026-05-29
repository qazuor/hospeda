import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { describe, expect, it } from 'vitest';
import { computeSectionSummary } from '../section-summarizer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSection(fields: SectionConfig['fields']): SectionConfig {
    return {
        id: 'test-section',
        layout: LayoutTypeEnum.GRID,
        fields
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeSectionSummary', () => {
    // ---- Empty / null values ----

    it('returns "— sin datos" when all field values are empty strings', () => {
        const section = makeSection([
            { id: 'name', type: FieldTypeEnum.TEXT },
            { id: 'type', type: FieldTypeEnum.SELECT }
        ]);
        const result = computeSectionSummary({
            values: { name: '', type: '' },
            section
        });
        expect(result).toBe('— sin datos');
    });

    it('returns "— sin datos" when the values object is empty', () => {
        const section = makeSection([{ id: 'name', type: FieldTypeEnum.TEXT }]);
        const result = computeSectionSummary({ values: {}, section });
        expect(result).toBe('— sin datos');
    });

    // ---- Non-empty values ----

    it('joins up to 3 non-empty field values with " · "', () => {
        const section = makeSection([
            { id: 'name', type: FieldTypeEnum.TEXT },
            { id: 'type', type: FieldTypeEnum.TEXT },
            { id: 'city', type: FieldTypeEnum.TEXT }
        ]);
        const result = computeSectionSummary({
            values: { name: 'Hotel Plaza', type: 'Hotel', city: 'Gualeguaychú' },
            section
        });
        expect(result).toBe('Hotel Plaza · Hotel · Gualeguaychú');
    });

    it('caps at 3 fields even when more are non-empty', () => {
        const section = makeSection([
            { id: 'f1', type: FieldTypeEnum.TEXT },
            { id: 'f2', type: FieldTypeEnum.TEXT },
            { id: 'f3', type: FieldTypeEnum.TEXT },
            { id: 'f4', type: FieldTypeEnum.TEXT }
        ]);
        const result = computeSectionSummary({
            values: { f1: 'A', f2: 'B', f3: 'C', f4: 'D' },
            section
        });
        // Should only include first 3
        expect(result).toBe('A · B · C');
    });

    it('skips empty fields and includes next available', () => {
        const section = makeSection([
            { id: 'f1', type: FieldTypeEnum.TEXT },
            { id: 'f2', type: FieldTypeEnum.TEXT },
            { id: 'f3', type: FieldTypeEnum.TEXT }
        ]);
        const result = computeSectionSummary({
            values: { f1: '', f2: 'Valor B', f3: 'Valor C' },
            section
        });
        expect(result).toBe('Valor B · Valor C');
    });

    // ---- Gallery section ----

    it('returns photo count for a GALLERY-type field', () => {
        const section = makeSection([{ id: 'media.gallery', type: FieldTypeEnum.GALLERY }]);
        const result = computeSectionSummary({
            values: {
                'media.gallery': [{ url: 'a.jpg' }, { url: 'b.jpg' }, { url: 'c.jpg' }]
            },
            section
        });
        expect(result).toBe('3 fotos');
    });

    it('returns "1 foto" in singular for a single-image gallery', () => {
        const section = makeSection([{ id: 'images', type: FieldTypeEnum.GALLERY }]);
        const result = computeSectionSummary({
            values: { images: [{ url: 'a.jpg' }] },
            section
        });
        expect(result).toBe('1 foto');
    });

    it('returns "— sin datos" for a gallery with no photos', () => {
        const section = makeSection([{ id: 'images', type: FieldTypeEnum.GALLERY }]);
        const result = computeSectionSummary({
            values: { images: [] },
            section
        });
        expect(result).toBe('— sin datos');
    });

    // ---- Custom summarizer override ----

    it('calls the custom summarizer when provided instead of generic', () => {
        const section = makeSection([{ id: 'name', type: FieldTypeEnum.TEXT }]);
        const customFn = () => 'Custom summary text';
        const result = computeSectionSummary({ values: { name: 'Hotel' }, section, customFn });
        expect(result).toBe('Custom summary text');
    });

    // ---- Boolean values ----

    it('renders boolean true as "Sí"', () => {
        const section = makeSection([{ id: 'isFeatured', type: FieldTypeEnum.SWITCH }]);
        const result = computeSectionSummary({
            values: { isFeatured: true },
            section
        });
        expect(result).toBe('Sí');
    });

    it('renders boolean false as "No"', () => {
        const section = makeSection([{ id: 'isFeatured', type: FieldTypeEnum.SWITCH }]);
        const result = computeSectionSummary({
            values: { isFeatured: false },
            section
        });
        expect(result).toBe('No');
    });

    // ---- Number values ----

    it('renders numbers as strings', () => {
        const section = makeSection([{ id: 'price', type: FieldTypeEnum.NUMBER }]);
        const result = computeSectionSummary({
            values: { price: 150 },
            section
        });
        expect(result).toBe('150');
    });

    // ---- Truncation ----

    it('truncates values longer than 40 characters', () => {
        const section = makeSection([{ id: 'desc', type: FieldTypeEnum.TEXT }]);
        const longValue = 'A'.repeat(50);
        const result = computeSectionSummary({
            values: { desc: longValue },
            section
        });
        expect(result).toMatch(/…$/);
        expect(result.length).toBeLessThan(50);
    });

    // ---- Skips HIDDEN / COMPUTED fields ----

    it('skips HIDDEN and COMPUTED fields', () => {
        const section = makeSection([
            { id: 'hiddenId', type: FieldTypeEnum.HIDDEN },
            { id: 'computed', type: FieldTypeEnum.COMPUTED },
            { id: 'name', type: FieldTypeEnum.TEXT }
        ]);
        const result = computeSectionSummary({
            values: { hiddenId: 'some-id', computed: 'computed-val', name: 'Hotel' },
            section
        });
        expect(result).toBe('Hotel');
    });
});
