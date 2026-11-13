/**
 * @file PoliciesPanel.accommodation-fields.test.tsx
 * @description The accommodation-only house-rule controls: booking deposit and
 * spoken languages (HOS-2120), private-events details (HOS-2122). Each must
 * let the host set AND clear its value, and an emptied control must remove its
 * key rather than write `false`/`''`/`[]`.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PoliciesPanel } from '@/components/listing/editor/PoliciesPanel.client';
import type { ListingPolicyValues } from '@/lib/listing/listing-policies';

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}));

const NOTE = { es: 'Por transferencia', en: '', pt: '' };

function renderPanel(
    policies: ListingPolicyValues,
    keys = ['eventsAllowed', 'eventsDetails', 'deposit', 'spokenLanguages'] as const
) {
    const onChange = vi.fn();
    render(
        <PoliciesPanel
            locale="es"
            idPrefix="acc"
            keys={keys}
            policies={policies}
            errors={{}}
            onChange={onChange}
        />
    );
    return { onChange };
}

describe('deposit field (HOS-2120)', () => {
    it('sets a deposit to "yes"', () => {
        // Arrange
        const { onChange } = renderPanel({});

        // Act
        fireEvent.change(document.getElementById('acc-policies-deposit-required') as HTMLElement, {
            target: { value: 'yes' }
        });

        // Assert
        expect(onChange).toHaveBeenLastCalledWith('deposit', { required: true });
    });

    it('shows percentage and note only for a "yes", and writes the percentage', () => {
        // Arrange
        const { onChange } = renderPanel({ deposit: { required: true } });

        // Act
        fireEvent.change(screen.getByLabelText('Porcentaje de la seña (%)'), {
            target: { value: '30' }
        });

        // Assert
        expect(onChange).toHaveBeenLastCalledWith('deposit', { required: true, percentage: 30 });
        expect(screen.getAllByLabelText(/^Nota/)).toHaveLength(3);
    });

    it('clears the percentage when emptied, keeping the rest', () => {
        const { onChange } = renderPanel({
            deposit: { required: true, percentage: 30, notes: NOTE }
        });
        fireEvent.change(screen.getByLabelText('Porcentaje de la seña (%)'), {
            target: { value: '' }
        });
        expect(onChange).toHaveBeenLastCalledWith('deposit', { required: true, notes: NOTE });
    });

    it('drops percentage and note when switched to "no"', () => {
        const { onChange } = renderPanel({
            deposit: { required: true, percentage: 30, notes: NOTE }
        });
        fireEvent.change(document.getElementById('acc-policies-deposit-required') as HTMLElement, {
            target: { value: 'no' }
        });
        expect(onChange).toHaveBeenLastCalledWith('deposit', { required: false });
    });

    it('removes the key when switched back to "not informed"', () => {
        const { onChange } = renderPanel({ deposit: { required: false } });
        expect(screen.queryByLabelText('Porcentaje de la seña (%)')).toBeNull();
        fireEvent.change(document.getElementById('acc-policies-deposit-required') as HTMLElement, {
            target: { value: '' }
        });
        expect(onChange).toHaveBeenLastCalledWith('deposit', undefined);
    });
});

describe('spoken languages field (HOS-2120)', () => {
    it('renders the seven closed values', () => {
        renderPanel({});
        for (const label of [
            'Español',
            'Inglés',
            'Portugués',
            'Italiano',
            'Francés',
            'Alemán',
            'Otros idiomas'
        ]) {
            expect(screen.getByLabelText(label)).toBeInTheDocument();
        }
    });

    it('adds a language in canonical order', () => {
        const { onChange } = renderPanel({ spokenLanguages: ['fr'] });
        fireEvent.click(screen.getByLabelText('Inglés'));
        expect(onChange).toHaveBeenLastCalledWith('spokenLanguages', ['en', 'fr']);
    });

    it('removes the key when the last language is unticked', () => {
        const { onChange } = renderPanel({ spokenLanguages: ['pt'] });
        fireEvent.click(screen.getByLabelText('Portugués'));
        expect(onChange).toHaveBeenLastCalledWith('spokenLanguages', undefined);
    });
});

describe('events details field (HOS-2122)', () => {
    it.each([
        ['events are not allowed', { eventsAllowed: false }],
        ['events are not informed', {}]
    ])('is hidden when %s', (_label, policies) => {
        renderPanel(policies);
        expect(screen.queryByTestId('events-details')).toBeNull();
    });

    it('is shown when events are allowed, and writes each detail', () => {
        // Arrange
        const { onChange } = renderPanel({ eventsAllowed: true });

        // Act
        fireEvent.change(screen.getByLabelText('Máximo de invitados'), {
            target: { value: '40' }
        });

        // Assert
        expect(screen.getByTestId('events-details')).toBeInTheDocument();
        expect(onChange).toHaveBeenLastCalledWith('eventsDetails', { maxGuests: 40 });
    });

    it('writes the end time, tri-state sound and surcharge', () => {
        const { onChange } = renderPanel({ eventsAllowed: true, eventsDetails: { maxGuests: 40 } });

        fireEvent.change(screen.getByLabelText('Horario límite'), { target: { value: '00:00' } });
        expect(onChange).toHaveBeenLastCalledWith('eventsDetails', {
            maxGuests: 40,
            endTime: '00:00'
        });

        fireEvent.change(screen.getByLabelText('Se permite música o sonido amplificado'), {
            target: { value: 'no' }
        });
        expect(onChange).toHaveBeenLastCalledWith('eventsDetails', {
            maxGuests: 40,
            amplifiedSound: false
        });

        fireEvent.click(screen.getByLabelText('Cobro un cargo extra por evento'));
        expect(onChange).toHaveBeenLastCalledWith('eventsDetails', {
            maxGuests: 40,
            extraCost: true
        });
    });

    it('removes the key when the last detail is emptied', () => {
        const { onChange } = renderPanel({ eventsAllowed: true, eventsDetails: { maxGuests: 40 } });
        fireEvent.change(screen.getByLabelText('Máximo de invitados'), { target: { value: '' } });
        expect(onChange).toHaveBeenLastCalledWith('eventsDetails', undefined);
    });

    it('is not rendered by a vertical that does not own the key', () => {
        renderPanel({ eventsAllowed: true, eventsDetails: { maxGuests: 40 } }, [
            'eventsAllowed'
        ] as const);
        expect(screen.queryByTestId('events-details')).toBeNull();
    });
});

describe('maximum stay (HOS-2121)', () => {
    it('is no longer rendered by the panel', () => {
        renderPanel({ maxNights: 10 }, ['maxNights', 'deposit'] as const);
        expect(document.getElementById('acc-policies-maxNights')).toBeNull();
    });
});
