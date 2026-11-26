/** Accommodation validation regression net, kept separate from CRUD behavior. */
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addToast, FAQ_1, mockAdd, mockUpdate, renderSection } from './faq-accommodation-fixtures';

describe('FaqSection accommodation validation', () => {
    beforeEach(() => {
        mockAdd.mockReset();
        mockUpdate.mockReset();
        vi.mocked(addToast).mockClear();
    });

    it('marks both add-form fields, toasts and focuses when saving with empty values', () => {
        renderSection([]);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        // No silent return: the fields are marked, nothing is sent (HOS-794).
        expect(mockAdd).not.toHaveBeenCalled();
        expect(screen.getByText('La pregunta es obligatoria')).toBeInTheDocument();
        expect(screen.getByText('La respuesta es obligatoria')).toBeInTheDocument();
        expect(screen.getByLabelText('Pregunta')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Pregunta')).toHaveFocus();
        expect(vi.mocked(addToast)).toHaveBeenCalledWith({
            type: 'error',
            message: 'Revisá los campos marcados'
        });
    });

    it('marks only the empty field when the other one is filled', () => {
        renderSection([]);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));

        fireEvent.change(screen.getByLabelText('Pregunta'), {
            target: { value: '¿Hay wifi en las habitaciones?' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        expect(mockAdd).not.toHaveBeenCalled();
        expect(screen.queryByText('La pregunta es obligatoria')).not.toBeInTheDocument();
        expect(screen.getByText('La respuesta es obligatoria')).toBeInTheDocument();
    });

    it('surfaces the schema minimum instead of failing silently (HOS-794 AC-2)', () => {
        renderSection([]);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));

        fireEvent.change(screen.getByLabelText('Pregunta'), {
            target: { value: '¿Wifi?' }
        });
        fireEvent.change(screen.getByLabelText('Respuesta'), {
            target: { value: 'Sí.' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        // Both present values are below the schema's ten-character minimum.
        expect(mockAdd).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Pregunta')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Respuesta')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Pregunta')).toHaveAccessibleDescription(
            /La pregunta debe tener al menos 10 caracteres/
        );
        expect(screen.getByLabelText('Respuesta')).toHaveAccessibleDescription(
            /La respuesta debe tener al menos 10 caracteres/
        );
    });

    it('clears a field error as soon as the user edits that field', () => {
        renderSection([]);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        expect(screen.getByText('La pregunta es obligatoria')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Pregunta'), {
            target: { value: '¿Hay wifi en las habitaciones?' }
        });

        expect(screen.queryByText('La pregunta es obligatoria')).not.toBeInTheDocument();
        // The untouched field keeps its error.
        expect(screen.getByText('La respuesta es obligatoria')).toBeInTheDocument();
    });

    it('marks the edit form fields instead of returning silently', () => {
        renderSection([FAQ_1]);
        fireEvent.click(screen.getByRole('button', { name: /^Editar/ }));

        fireEvent.change(screen.getByLabelText('Pregunta'), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        expect(mockUpdate).not.toHaveBeenCalled();
        expect(screen.getByText('La pregunta es obligatoria')).toBeInTheDocument();
        expect(screen.getByLabelText('Pregunta')).toHaveFocus();
    });
});
