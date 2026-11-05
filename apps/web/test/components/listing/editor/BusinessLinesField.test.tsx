/**
 * @file BusinessLinesField.test.tsx
 * @description Business-line selector (HOS-1787 leaf 5.6).
 *
 * Covers the visibility rules the catalog decides: `selected` flags, the
 * hidden `NOT_ALLOWED_FOR_TYPE` options (AC:5:1), the single-line verticals
 * rendering nothing (AC:5:9) and the "keep at least one selected" guard.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BusinessLinesField } from '@/components/listing/editor/BusinessLinesField.client';

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}));

vi.mock('@/components/listing/editor/BusinessLinesField.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

function renderField(
    overrides: Partial<React.ComponentProps<typeof BusinessLinesField>> = {}
): ReturnType<typeof render> {
    return render(
        <BusinessLinesField
            locale="es"
            vertical="venue"
            type="BAR"
            selected={[]}
            onChange={() => undefined}
            errors={{}}
            {...overrides}
        />
    );
}

describe('BusinessLinesField — TEST:5.6:2 (AC:5:1)', () => {
    it('marks both lines of a BAR as selected', () => {
        renderField({ type: 'BAR', selected: ['food', 'nightlife'] });

        expect(screen.getAllByRole('checkbox')).toHaveLength(2);
        expect(screen.getByRole('checkbox', { name: /food/ })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: /nightlife/ })).toBeChecked();
    });

    it('does not render the nightlife option for a HELADERIA', () => {
        renderField({ type: 'HELADERIA', selected: ['food'] });

        expect(screen.queryByRole('checkbox', { name: /nightlife/ })).toBeNull();
        expect(screen.getAllByRole('checkbox')).toHaveLength(1);
        expect(screen.getByRole('checkbox', { name: /food/ })).toBeChecked();
    });

    it('keeps nightlife available for a RESTAURANT while only food is selected', () => {
        renderField({ type: 'RESTAURANT', selected: ['food'] });

        expect(screen.getByRole('checkbox', { name: /food/ })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: /nightlife/ })).toBeEnabled();
        expect(screen.getByRole('checkbox', { name: /nightlife/ })).not.toBeChecked();
    });

    it('does not let the owner uncheck the last selected line', () => {
        renderField({ type: 'BAR', selected: ['food'] });

        expect(screen.getByRole('checkbox', { name: /food/ })).toBeDisabled();
        expect(screen.getByRole('checkbox', { name: /nightlife/ })).toBeEnabled();
    });

    it('reports the next selection in catalog order, preserving the other option', () => {
        const onChange = vi.fn();
        renderField({ type: 'BAR', selected: ['food'], onChange });

        fireEvent.click(screen.getByRole('checkbox', { name: /nightlife/ }));

        expect(onChange).toHaveBeenCalledWith(['food', 'nightlife']);
    });

    it('shows the field error the selector receives', () => {
        renderField({ errors: { businessLines: 'Este tipo de local no ofrece este rubro.' } });

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Este tipo de local no ofrece este rubro.'
        );
    });
});

describe('BusinessLinesField — TEST:5.6:3 (AC:5:9)', () => {
    it('renders nothing for a vertical with a single catalog line', () => {
        const { container } = renderField({ vertical: 'experience', type: 'TOUR_GUIDE' });

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    });
});
