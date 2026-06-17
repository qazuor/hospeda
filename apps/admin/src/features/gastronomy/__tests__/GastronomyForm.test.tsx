// @vitest-environment jsdom
/**
 * @file GastronomyForm.test.tsx
 * Unit tests for `GastronomyForm` (SPEC-239 T-059).
 *
 * Covers:
 *  - Renders all required fields
 *  - Shows validation error on empty submit
 *  - Calls onSubmit with valid data
 *  - Calls onCancel when Cancel is clicked
 *  - Cancel is absent when onCancel is not provided
 *  - Submit button shows loading label when isPending
 *  - Custom submitLabel overrides default
 *  - All type options are rendered
 *  - All price range options are rendered
 *  - Submit is disabled while isPending
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GastronomyForm } from '../components/GastronomyForm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderForm(overrides?: Partial<React.ComponentProps<typeof GastronomyForm>>) {
    const defaultOnSubmit = vi.fn();
    render(
        <GastronomyForm
            onSubmit={defaultOnSubmit}
            {...overrides}
        />
    );
    return { onSubmit: overrides?.onSubmit ?? defaultOnSubmit };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GastronomyForm — rendering', () => {
    it('should render the name field', () => {
        renderForm();
        expect(screen.getByPlaceholderText(/Ej: La Parrilla/i)).toBeInTheDocument();
    });

    it('should render the summary field', () => {
        renderForm();
        expect(screen.getByPlaceholderText(/Resumen corto/i)).toBeInTheDocument();
    });

    it('should render the description field', () => {
        renderForm();
        expect(screen.getByPlaceholderText(/Descripción completa/i)).toBeInTheDocument();
    });

    it('should render the type select with options', () => {
        renderForm();
        const select = screen.getByRole('combobox', { name: /tipo de establecimiento/i });
        expect(select).toBeInTheDocument();
        expect(screen.getByText('Restaurante')).toBeInTheDocument();
        expect(screen.getByText('Bar')).toBeInTheDocument();
        expect(screen.getByText('Café')).toBeInTheDocument();
        expect(screen.getByText('Parrilla')).toBeInTheDocument();
        expect(screen.getByText('Cervecería')).toBeInTheDocument();
    });

    it('should render the price range select with all options', () => {
        renderForm();
        expect(screen.getByText('Económico ($)')).toBeInTheDocument();
        expect(screen.getByText('Intermedio ($$)')).toBeInTheDocument();
        expect(screen.getByText('Elevado ($$$)')).toBeInTheDocument();
        expect(screen.getByText('Premium ($$$$)')).toBeInTheDocument();
    });

    it('should render the menu URL field', () => {
        renderForm();
        expect(screen.getByPlaceholderText(/https:\/\/tu-restaurante/i)).toBeInTheDocument();
    });

    it('should render the destination ID field', () => {
        renderForm();
        expect(screen.getByPlaceholderText(/UUID del destino/i)).toBeInTheDocument();
    });

    it('should render the owner ID field', () => {
        renderForm();
        expect(screen.getByPlaceholderText(/UUID del propietario/i)).toBeInTheDocument();
    });

    it('should render the submit button with default label', () => {
        renderForm();
        expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
    });

    it('should render Cancel button when onCancel is provided', () => {
        renderForm({ onCancel: vi.fn() });
        expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    });

    it('should NOT render Cancel button when onCancel is not provided', () => {
        renderForm();
        expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    });

    it('should use a custom submitLabel', () => {
        renderForm({ submitLabel: 'Crear gastronomía' });
        expect(screen.getByRole('button', { name: 'Crear gastronomía' })).toBeInTheDocument();
    });

    it('should show saving label when isPending', () => {
        renderForm({ isPending: true });
        expect(screen.getByRole('button', { name: /Guardando/i })).toBeInTheDocument();
    });

    it('should disable submit while isPending', () => {
        renderForm({ isPending: true });
        expect(screen.getByRole('button', { name: /Guardando/i })).toBeDisabled();
    });
});

describe('GastronomyForm — interaction', () => {
    it('should call onCancel when Cancel is clicked', async () => {
        const user = userEvent.setup();
        const onCancel = vi.fn();
        renderForm({ onCancel });

        await user.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onSubmit with valid data', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);

        // Pre-fill required fields via defaultValues to avoid intermediate validation errors.
        // Must be a valid RFC 4122 UUID: Zod v4 validates version nibble [1-8] and variant nibble [89ab].
        renderForm({
            onSubmit,
            defaultValues: {
                name: 'La Parrilla de Juan',
                type: 'RESTAURANT' as never,
                destinationId: 'a1b2c3d4-e5f6-4789-8abc-def012345678'
            }
        });

        // Use fireEvent.submit on the form element directly — this is more reliable than
        // clicking the submit button in jsdom when TanStack Form uses async handleSubmit.
        const form = screen.getByRole('form', { name: /formulario de gastronomía/i });
        fireEvent.submit(form);

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 3000 });
    });

    it('should show error alert when Zod validation fails (empty name)', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        renderForm({ onSubmit });

        // Clear name and submit
        const nameField = screen.getByPlaceholderText(/Ej: La Parrilla/i);
        await user.clear(nameField);
        await user.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => {
            // Either a global alert or field error should appear
            const alert =
                screen.queryByRole('alert') ?? screen.queryByText(/requerido|inválid|invalid/i);
            expect(alert).toBeTruthy();
        });

        expect(onSubmit).not.toHaveBeenCalled();
    });
});
