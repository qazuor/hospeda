/**
 * @file kit-fields.test.tsx
 * @description HOS-2488: the listing editor sections that moved to the field kit
 * (basic info, practical info, price, policies) give every control a visible
 * label, keep their `buildFieldId` ids, carry the section `data-help` anchor and
 * never rely on a placeholder as a label.
 *
 * Runs against the REAL i18n catalog so the labels are the shipped ones.
 *
 * @module test/components/listing/editor/kit-fields
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BasicInfoSection } from '../../../../src/components/listing/editor/BasicInfoSection.client';
import { PoliciesPanel } from '../../../../src/components/listing/editor/PoliciesPanel.client';
import { PracticalInfoSection } from '../../../../src/components/listing/editor/PracticalInfoSection.client';
import { PriceSection } from '../../../../src/components/listing/editor/PriceSection.client';
import { buildEditData } from './edit-data-fixture';

vi.mock('@/components/host/editor/RichTextEditor.client', () => ({
    RichTextEditor: ({ id, ariaLabel }: { id: string; ariaLabel?: string }) => (
        <textarea
            id={id}
            aria-label={ariaLabel}
            readOnly
        />
    )
}));

/** Every text-like control of a container, as the placeholder-as-label audit sees it. */
function textControls(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>('input, textarea, select')).filter(
        (element) => !['checkbox', 'radio', 'hidden'].includes(element.getAttribute('type') ?? '')
    );
}

/** Whether a control is named by something other than its placeholder. */
function hasRealLabel(element: HTMLElement): boolean {
    const id = element.id;
    const viaLabel = id !== '' && document.querySelector(`label[for="${id}"]`) !== null;
    return (
        viaLabel || element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby')
    );
}

describe('listing BasicInfoSection on the kit (HOS-2488)', () => {
    const destinations = [{ id: 'd1', name: 'Colón' }];

    function renderSection() {
        return render(
            <BasicInfoSection
                locale="es"
                vertical="venue"
                data={buildEditData({
                    name: 'Bar',
                    summary: 'Un resumen largo',
                    listingType: 'BAR'
                })}
                destinations={destinations}
                destinationsLoadFailed={false}
                errors={{}}
                onFieldChange={vi.fn()}
            />
        );
    }

    it('labels every control and keeps the derived ids', () => {
        // Arrange + Act
        const { container } = renderSection();

        // Assert
        expect(screen.getByLabelText('Nombre del comercio')).toHaveAttribute('id', 'ce-name');
        expect(screen.getByLabelText('Ciudad / Destino')).toHaveAttribute('id', 'ce-destinationId');
        expect(screen.getByLabelText('Categoría')).toHaveAttribute('id', 'ce-type');
        expect(screen.getByLabelText('Resumen')).toHaveAttribute('id', 'ce-summary');
        expect(screen.getByLabelText('Descripción')).toHaveAttribute('id', 'ce-description');
        for (const control of textControls(container)) {
            expect(hasRealLabel(control), `${control.tagName}#${control.id}`).toBe(true);
        }
    });

    it('is one kit Section anchored to the datos page of its vertical', () => {
        // Arrange + Act
        const { container } = renderSection();

        // Assert
        const section = container.querySelector('[data-kit-section]');
        expect(section).toHaveAttribute('data-help', 'section:venue.datos');
        expect(container.querySelectorAll('[data-kit-section]')).toHaveLength(1);
    });

    it('does not draw a hand-written asterisk in any label', () => {
        // Arrange + Act
        const { container } = renderSection();

        // Assert
        for (const label of Array.from(container.querySelectorAll('label'))) {
            expect(label.textContent ?? '').not.toMatch(/\*/);
        }
    });
});

describe('PracticalInfoSection on the kit (HOS-2488)', () => {
    it('labels both duration boxes and the two checklists, ids unchanged', () => {
        // Arrange + Act
        const { container } = render(
            <PracticalInfoSection
                locale="es"
                data={buildEditData({ whatToBring: [], requirements: [] })}
                errors={{ durationMinutes: 'Duración inválida' }}
                onFieldChange={vi.fn()}
            />
        );

        // Assert
        expect(screen.getByLabelText('Duración — horas')).toHaveAttribute(
            'id',
            'ce-durationMinutes-hours'
        );
        const minutes = screen.getByLabelText('Duración — minutos');
        expect(minutes).toHaveAttribute('id', 'ce-durationMinutes-minutes');
        expect(minutes).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Qué llevar')).toHaveAttribute('id', 'ce-whatToBring');
        expect(screen.getByLabelText('Requisitos')).toHaveAttribute('id', 'ce-requirements');
        expect(container.querySelector('[data-kit-section]')).toHaveAttribute(
            'data-help',
            'section:experience.datos-practicos'
        );
    });
});

describe('PriceSection on the kit (HOS-2488)', () => {
    it('shows the price in an InputGroup with an ARS suffix and a decimal keypad', () => {
        // Arrange + Act
        const { container } = render(
            <PriceSection
                locale="es"
                vertical="experience"
                data={buildEditData({ priceFrom: 150000 })}
                errors={{}}
                onFieldChange={vi.fn()}
            />
        );

        // Assert
        const price = screen.getByLabelText('Precio desde (ARS)');
        expect(price).toHaveAttribute('id', 'ce-priceFrom');
        expect(price).toHaveAttribute('inputmode', 'decimal');
        expect(container.querySelector('[data-addon="suffix"]')).toHaveTextContent('ARS');
        expect(container.querySelector('[data-kit-section]')).toHaveAttribute(
            'data-help',
            'section:experience.precio'
        );
    });

    it('disables the price controls while the price is on request', () => {
        // Arrange + Act
        render(
            <PriceSection
                locale="es"
                vertical="experience"
                data={buildEditData({ isPriceOnRequest: true })}
                errors={{}}
                onFieldChange={vi.fn()}
            />
        );

        // Assert
        expect(screen.getByLabelText('Precio desde (ARS)')).toBeDisabled();
        expect(screen.getByLabelText('Unidad de precio')).toBeDisabled();
    });
});

describe('PoliciesPanel on the kit (HOS-2488)', () => {
    it('labels the tri-state, the time windows and the cancellation text', () => {
        // Arrange + Act
        const { container } = render(
            <PoliciesPanel
                locale="es"
                idPrefix="ce"
                keys={['privateGroups', 'checkIn', 'cancellation']}
                policies={{}}
                errors={{}}
                onChange={vi.fn()}
            />
        );

        // Assert
        expect(screen.getByLabelText('Hago precio especial para grupos privados')).toHaveAttribute(
            'id',
            'ce-policies-privateGroups'
        );
        expect(screen.getByLabelText('Política de cancelación')).toHaveAttribute(
            'id',
            'ce-policies-cancellation'
        );
        expect(screen.getAllByLabelText('Desde')[0]).toHaveAttribute(
            'id',
            'ce-policies-checkIn-from'
        );
        for (const control of textControls(container)) {
            expect(hasRealLabel(control), `${control.tagName}#${control.id}`).toBe(true);
        }
    });
});
