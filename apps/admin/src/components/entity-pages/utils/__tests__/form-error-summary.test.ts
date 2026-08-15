/**
 * @file form-error-summary.test.ts
 * @description Unit coverage for the H-28 summary builder: an error whose field
 * has no slot in the form must still reach the user. The rule the whole fix
 * rests on is "nothing is ever dropped", so the interesting cases are the ones
 * where a field is NOT part of the rendered sections.
 */

import { describe, expect, it } from 'vitest';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { buildFormErrorSummaryEntries } from '../form-error-summary';

const sections: readonly SectionConfig[] = [
    {
        id: 'basic-info',
        layout: LayoutTypeEnum.GRID,
        fields: [
            { id: 'title', type: FieldTypeEnum.TEXT, label: 'Título' },
            { id: 'summary', type: FieldTypeEnum.TEXTAREA, label: 'Resumen' }
        ]
    },
    {
        id: 'location',
        layout: LayoutTypeEnum.GRID,
        fields: [{ id: 'address', type: FieldTypeEnum.TEXT, label: 'Dirección' }],
        sections: [
            {
                id: 'contact',
                layout: LayoutTypeEnum.GRID,
                fields: [{ id: 'contactInfo', type: FieldTypeEnum.TEXT, label: 'Contacto' }]
            }
        ]
    }
];

describe('buildFormErrorSummaryEntries', () => {
    it('returns nothing when there are no errors', () => {
        // Arrange + Act
        const entries = buildFormErrorSummaryEntries({ errors: {}, sections });

        // Assert
        expect(entries).toEqual([]);
    });

    it('keeps an error whose field is absent from the form (H-28)', () => {
        // Arrange — `authorId` is rendered nowhere, so it has no error slot.
        const errors = { authorId: 'Tipo de dato inválido' };

        // Act
        const entries = buildFormErrorSummaryEntries({ errors, sections });

        // Assert — dropped is exactly what must never happen.
        expect(entries).toEqual([
            { field: 'authorId', label: 'authorId', message: 'Tipo de dato inválido' }
        ]);
    });

    it('labels each error with its field label, walking nested sections', () => {
        // Arrange
        const errors = {
            title: 'El título es obligatorio',
            contactInfo: 'Contacto inválido'
        };

        // Act
        const entries = buildFormErrorSummaryEntries({ errors, sections });

        // Assert
        expect(entries.map((e) => e.label)).toEqual(['Título', 'Contacto']);
    });

    it('orders entries by field declaration order, not by object key order', () => {
        // Arrange — reverse of the declared order
        const errors = {
            address: 'Dirección inválida',
            summary: 'El resumen es obligatorio',
            title: 'El título es obligatorio'
        };

        // Act
        const entries = buildFormErrorSummaryEntries({ errors, sections });

        // Assert — the summary reads like the form
        expect(entries.map((e) => e.field)).toEqual(['title', 'summary', 'address']);
    });

    it('pushes fields the form does not know to the end without losing them', () => {
        // Arrange
        const errors = {
            authorId: 'Tipo de dato inválido',
            title: 'El título es obligatorio'
        };

        // Act
        const entries = buildFormErrorSummaryEntries({ errors, sections });

        // Assert
        expect(entries.map((e) => e.field)).toEqual(['title', 'authorId']);
    });

    it('borrows the parent label for a sub-path such as a multilang input', () => {
        // Arrange — multilang and nested-schema errors arrive dotted
        const errors = {
            'title.es': 'El título es obligatorio',
            'address.city': 'La ciudad es obligatoria'
        };

        // Act
        const entries = buildFormErrorSummaryEntries({ errors, sections });

        // Assert
        expect(entries).toEqual([
            { field: 'title.es', label: 'Título', message: 'El título es obligatorio' },
            { field: 'address.city', label: 'Dirección', message: 'La ciudad es obligatoria' }
        ]);
    });

    it('skips empty and undefined messages instead of rendering a blank row', () => {
        // Arrange
        const errors = { title: undefined, summary: '', address: 'Dirección inválida' };

        // Act
        const entries = buildFormErrorSummaryEntries({ errors, sections });

        // Assert
        expect(entries.map((e) => e.field)).toEqual(['address']);
    });

    it('works with no sections at all, falling back to the field path', () => {
        // Arrange — e.g. a page that renders a custom form body
        const errors = { 'seo.title': 'Demasiado largo' };

        // Act
        const entries = buildFormErrorSummaryEntries({ errors });

        // Assert
        expect(entries).toEqual([
            { field: 'seo.title', label: 'seo.title', message: 'Demasiado largo' }
        ]);
    });
});
