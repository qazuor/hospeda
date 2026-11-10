/**
 * @file MinAgeField.test.tsx
 * @description Minimum-age input extracted from the owner create form
 * (DEC-FAC-050, HOS-1787 leaf 5.6 review).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MinAgeField } from '@/components/listing/editor/MinAgeField.client';

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}));

vi.mock('@/components/listing/editor/MinAgeField.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

describe('MinAgeField', () => {
    it('renders the labelled value the type suggested', () => {
        render(
            <MinAgeField
                locale="es"
                value={18}
                onChange={() => undefined}
            />
        );

        expect(screen.getByLabelText('Edad mínima')).toHaveValue(18);
    });

    it('reports the parsed number on change', () => {
        const onChange = vi.fn();
        render(
            <MinAgeField
                locale="es"
                value={18}
                onChange={onChange}
            />
        );

        fireEvent.change(screen.getByLabelText('Edad mínima'), { target: { value: '21' } });

        expect(onChange).toHaveBeenCalledWith(21);
    });

    it('reports null when the owner clears the field', () => {
        const onChange = vi.fn();
        render(
            <MinAgeField
                locale="es"
                value={18}
                onChange={onChange}
            />
        );

        fireEvent.change(screen.getByLabelText('Edad mínima'), { target: { value: '' } });

        expect(onChange).toHaveBeenCalledWith(null);
    });

    it('wires the inline error to the input', () => {
        render(
            <MinAgeField
                locale="es"
                value={null}
                onChange={() => undefined}
                error="Edad inválida"
            />
        );

        const input = screen.getByLabelText('Edad mínima');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAttribute('aria-describedby', 'policies-minAge-error');
        expect(screen.getByRole('alert')).toHaveTextContent('Edad inválida');
    });
});
