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

    // ---- UUID-array fields (SPEC-172 PR4 fix) ----

    it('shows count instead of raw UUIDs for arrays of UUID strings', () => {
        const section = makeSection([{ id: 'relatedIds', type: FieldTypeEnum.TEXT }]);
        const uuids = [
            '6199060f-d0c5-4e1a-b044-c4ca5a7c0b0b',
            'da6ad2ed-63ad-4417-853d-88328570d9e2',
            '822cbd3d-005f-4d84-8b15-b26ab190bba7'
        ];
        const result = computeSectionSummary({
            values: { relatedIds: uuids },
            section
        });
        // Should show "3 elementos" not the raw UUIDs joined
        expect(result).toBe('3 elementos');
        expect(result).not.toContain('6199060f');
    });

    // ---- AMENITY_SELECT / FEATURE_SELECT count summary (SPEC-172 PR4) ----

    it('shows "N amenidades" for AMENITY_SELECT fields', () => {
        const section = makeSection([{ id: 'amenityIds', type: FieldTypeEnum.AMENITY_SELECT }]);
        const amenityIds = [
            '6199060f-d0c5-4e1a-b044-c4ca5a7c0b0b',
            'da6ad2ed-63ad-4417-853d-88328570d9e2',
            '822cbd3d-005f-4d84-8b15-b26ab190bba7',
            '3a744b90-e3ef-4468-8f32-a4d6351910c3',
            '91ed29a6-bcd0-4879-ad18-6257c9c86d92'
        ];
        const result = computeSectionSummary({
            values: { amenityIds },
            section
        });
        expect(result).toBe('5 amenidades');
    });

    it('shows "1 amenidad" singular for a single amenity', () => {
        const section = makeSection([{ id: 'amenityIds', type: FieldTypeEnum.AMENITY_SELECT }]);
        const result = computeSectionSummary({
            values: { amenityIds: ['6199060f-d0c5-4e1a-b044-c4ca5a7c0b0b'] },
            section
        });
        expect(result).toBe('1 amenidad');
    });

    it('shows "N características" for FEATURE_SELECT fields', () => {
        const section = makeSection([{ id: 'featureIds', type: FieldTypeEnum.FEATURE_SELECT }]);
        const featureIds = [
            'f71ccd34-9c1d-41b8-929e-516df9ae8452',
            'e58c3847-bd4f-4ac6-9b04-2000601ea9ea',
            'e06a1699-c163-41ce-8829-50fbcee76901'
        ];
        const result = computeSectionSummary({
            values: { featureIds },
            section
        });
        expect(result).toBe('3 características');
    });

    it('shows combined "N amenidades, M características" for mixed section', () => {
        const section = makeSection([
            { id: 'amenityIds', type: FieldTypeEnum.AMENITY_SELECT },
            { id: 'featureIds', type: FieldTypeEnum.FEATURE_SELECT }
        ]);
        const result = computeSectionSummary({
            values: {
                amenityIds: Array.from(
                    { length: 13 },
                    (_, i) => `aaaaaaaa-0000-0000-0000-${String(i).padStart(12, '0')}`
                ),
                featureIds: Array.from(
                    { length: 7 },
                    (_, i) => `ffffffff-0000-0000-0000-${String(i).padStart(12, '0')}`
                )
            },
            section
        });
        expect(result).toBe('13 amenidades, 7 características');
    });

    it('returns "— sin datos" when amenity/feature arrays are empty', () => {
        const section = makeSection([
            { id: 'amenityIds', type: FieldTypeEnum.AMENITY_SELECT },
            { id: 'featureIds', type: FieldTypeEnum.FEATURE_SELECT }
        ]);
        const result = computeSectionSummary({
            values: { amenityIds: [], featureIds: [] },
            section
        });
        expect(result).toBe('— sin datos');
    });
});
