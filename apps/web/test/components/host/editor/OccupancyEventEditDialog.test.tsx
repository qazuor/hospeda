/**
 * @file OccupancyEventEditDialog.test.tsx
 * @description Tests for the manual-event edit/delete dialog (HOS-175).
 *
 * Covers: seeding the form from the event, saving the edited range + text,
 * client-side range validation (end before start is blocked), and delete.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OccupancyEventEditDialog } from '@/components/host/editor/OccupancyEventEditDialog.client';

vi.mock('@/components/host/editor/CalendarSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/shared/ui/Dialog.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

const t = (key: string, fallback?: string) => fallback ?? key;

const baseEvent = { startKey: '2026-08-10', endKey: '2026-08-12', title: 'Familia Pérez' };

function renderDialog(overrides: Partial<Parameters<typeof OccupancyEventEditDialog>[0]> = {}) {
    const onSave = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(
        <OccupancyEventEditDialog
            isOpen
            t={t}
            event={baseEvent}
            isSubmitting={false}
            error={null}
            onSave={onSave}
            onDelete={onDelete}
            onClose={onClose}
            {...overrides}
        />
    );
    return { onSave, onDelete, onClose };
}

describe('OccupancyEventEditDialog', () => {
    it('seeds the inputs from the event and saves the edited text + range', async () => {
        const { onSave } = renderDialog();
        const user = userEvent.setup();

        const textInput = screen.getByPlaceholderText('Ej: reservado fuera de la plataforma');
        expect(textInput).toHaveValue('Familia Pérez');

        fireEvent.change(textInput, { target: { value: 'Reserva directa' } });
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        expect(onSave).toHaveBeenCalledWith({
            newStartDate: '2026-08-10',
            newEndDate: '2026-08-12',
            note: 'Reserva directa'
        });
    });

    it('blocks saving when the end date is before the start date', async () => {
        const { onSave } = renderDialog();
        const user = userEvent.setup();

        const [startInput, endInput] = screen.getAllByDisplayValue(
            /2026-08-1[02]/
        ) as HTMLInputElement[];
        // Move the end before the start.
        fireEvent.change(endInput, { target: { value: '2026-08-09' } });
        void startInput;
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        expect(onSave).not.toHaveBeenCalled();
        expect(
            screen.getByText('La fecha de fin no puede ser anterior a la de inicio.')
        ).toBeInTheDocument();
    });

    it('emits an empty note as null', async () => {
        const { onSave } = renderDialog();
        const user = userEvent.setup();

        const textInput = screen.getByPlaceholderText('Ej: reservado fuera de la plataforma');
        fireEvent.change(textInput, { target: { value: '   ' } });
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        expect(onSave).toHaveBeenCalledWith({
            newStartDate: '2026-08-10',
            newEndDate: '2026-08-12',
            note: null
        });
    });

    it('applies minDate as the start input min (future-facing)', () => {
        renderDialog({ minDate: '2026-08-01' });
        const [startInput] = screen.getAllByDisplayValue(/2026-08-1[02]/) as HTMLInputElement[];
        expect(startInput).toHaveAttribute('min', '2026-08-01');
    });

    it('blocks moving the start into the past (before minDate and before the current start)', async () => {
        const { onSave } = renderDialog({ minDate: '2026-08-15' });
        const user = userEvent.setup();

        const [startInput] = screen.getAllByDisplayValue(/2026-08-1[02]/) as HTMLInputElement[];
        fireEvent.change(startInput, { target: { value: '2026-08-05' } });
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        expect(onSave).not.toHaveBeenCalled();
        expect(
            screen.getByText('No podés mover el bloqueo a una fecha pasada.')
        ).toBeInTheDocument();
    });

    it('still allows saving an ongoing event whose start is already before minDate', async () => {
        const { onSave } = renderDialog({
            event: { startKey: '2026-08-01', endKey: '2026-08-20', title: 'x' },
            minDate: '2026-08-15'
        });
        const user = userEvent.setup();

        // No date change (start stays at its already-past value) — must save.
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        expect(onSave).toHaveBeenCalledWith({
            newStartDate: '2026-08-01',
            newEndDate: '2026-08-20',
            note: 'x'
        });
    });

    it('calls onDelete when the delete button is clicked', async () => {
        const { onDelete } = renderDialog();
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Eliminar bloqueo' }));
        expect(onDelete).toHaveBeenCalledTimes(1);
    });
});
