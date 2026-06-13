/**
 * @fileoverview
 * Unit tests for diffTranslatableFields (SPEC-212 AC-5 shared helper).
 *
 * Pure function — no mocks required.
 */

import { describe, expect, it } from 'vitest';
import { diffTranslatableFields } from '../../src/translation/diff-translatable-fields';

describe('diffTranslatableFields', () => {
    const fieldNames = ['name', 'summary', 'description'] as const;

    it('returns changed fields when current differs from previous', () => {
        const result = diffTranslatableFields({
            previous: { name: 'Hotel Sol', summary: 'Resumen', description: 'Desc' },
            current: { name: 'Hotel Luna', summary: 'Resumen', description: 'Desc' },
            fieldNames
        });
        expect(result).toEqual({ name: 'Hotel Luna' });
    });

    it('returns empty object when all fields are unchanged', () => {
        const result = diffTranslatableFields({
            previous: { name: 'Hotel Sol', summary: 'Resumen', description: 'Desc' },
            current: { name: 'Hotel Sol', summary: 'Resumen', description: 'Desc' },
            fieldNames
        });
        expect(result).toEqual({});
    });

    it('includes a field when it was undefined in previous (new value)', () => {
        const result = diffTranslatableFields({
            previous: { name: undefined, summary: undefined, description: undefined },
            current: { name: 'Hotel Sol', summary: 'Resumen', description: 'Desc' },
            fieldNames
        });
        expect(result).toEqual({
            name: 'Hotel Sol',
            summary: 'Resumen',
            description: 'Desc'
        });
    });

    it('skips fields whose new value is empty / null / undefined', () => {
        const result = diffTranslatableFields({
            previous: { name: 'Hotel Sol', summary: 'Resumen' },
            current: { name: '', summary: null, description: undefined },
            fieldNames
        });
        expect(result).toEqual({});
    });

    it('returns multiple changed fields when several differ', () => {
        const result = diffTranslatableFields({
            previous: { name: 'Antes', summary: 'Antes', description: 'Fija' },
            current: { name: 'Después', summary: 'Después', description: 'Fija' },
            fieldNames
        });
        expect(result).toEqual({ name: 'Después', summary: 'Después' });
    });

    it('only processes fields listed in fieldNames', () => {
        const result = diffTranslatableFields({
            previous: { name: 'Hotel Sol' },
            current: { name: 'Hotel Sol', extraField: 'nuevo' },
            fieldNames: ['name'] // extraField not in fieldNames
        });
        expect(result).not.toHaveProperty('extraField');
        expect(result).toEqual({});
    });

    it('handles post field shape (title, summary, content)', () => {
        const result = diffTranslatableFields({
            previous: { title: 'Artículo', summary: 'Resumen', content: 'Contenido' },
            current: { title: 'Artículo nuevo', summary: 'Resumen', content: 'Contenido' },
            fieldNames: ['title', 'summary', 'content']
        });
        expect(result).toEqual({ title: 'Artículo nuevo' });
    });
});
