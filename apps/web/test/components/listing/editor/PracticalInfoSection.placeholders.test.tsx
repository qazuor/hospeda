/**
 * @file PracticalInfoSection.placeholders.test.tsx
 * @description The duration placeholders of the practical-info section must
 * read as EXAMPLES, not as loaded values (HOS-1763).
 *
 * A bare "2" / "30" in a `type="number"` box is indistinguishable from a value
 * the owner already entered: it is grey, it sits in the same place a saved
 * duration would, and the section's own hint says to leave both fields empty
 * when the duration is not published. The placeholders now carry an example
 * marker instead.
 *
 * @module test/components/listing/editor/PracticalInfoSection.placeholders
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PracticalInfoSection } from '../../../../src/components/listing/editor/PracticalInfoSection.client';
import { buildEditData } from './edit-data-fixture';

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? `[MISSING:${key}]`
    })
}));

function renderSection(): { container: HTMLElement } {
    const { container } = render(
        <PracticalInfoSection
            locale="es"
            data={buildEditData({
                durationHours: null,
                durationMinutesPart: null,
                whatToBring: [],
                requirements: [],
                cancellationPolicy: '',
                acceptsPrivateGroups: false
            })}
            errors={{}}
            onFieldChange={vi.fn()}
        />
    );
    return { container };
}

describe('PracticalInfoSection placeholders (HOS-1763)', () => {
    it('marks the duration placeholders as examples (TEST:1763:5a)', () => {
        renderSection();

        expect(screen.getByLabelText('Duración — horas')).toHaveAttribute('placeholder', 'Ej.: 2');
        expect(screen.getByLabelText('Duración — minutos')).toHaveAttribute(
            'placeholder',
            'Ej.: 30'
        );
    });

    it('never uses a digits-only placeholder anywhere in the section (TEST:1763:5b)', () => {
        const { container } = renderSection();
        const controls = Array.from(container.querySelectorAll('input, textarea'));
        const digitsOnly = controls
            .map((control) => control.getAttribute('placeholder'))
            .filter((placeholder): placeholder is string => placeholder !== null)
            .filter((placeholder) => /^\d+$/.test(placeholder));

        expect(digitsOnly).toEqual([]);
    });
});
