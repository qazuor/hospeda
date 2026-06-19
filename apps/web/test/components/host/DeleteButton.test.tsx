/**
 * @file DeleteButton.test.tsx
 * @description The host "Eliminar" island must: render the danger button,
 * require an inline confirmation, call the protected soft-delete endpoint with
 * the accommodation id on confirm, and surface an inline error on API failure.
 * This is the owner-facing entry point that exercises SPEC-230 (soft-deleted
 * rows leave the owner's protected list).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteButton } from '../../../src/components/host/DeleteButton.client';

vi.mock('../../../src/components/host/UnpublishButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

const softDeleteMock = vi.fn();
vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    accommodationEditApi: {
        softDelete: (args: { id: string }) => softDeleteMock(args)
    }
}));

const renderButton = () =>
    render(
        <DeleteButton
            accommodationId="acc-1"
            locale="es"
            label="Eliminar"
            confirmText="¿Eliminar esta propiedad?"
            confirmYes="Sí, eliminar"
            confirmNo="Cancelar"
            errorText="No se pudo eliminar. Intentá de nuevo."
        />
    );

describe('DeleteButton (host soft-delete island)', () => {
    beforeEach(() => {
        softDeleteMock.mockReset();
        // Stub reload so the success path does not blow up the test environment.
        Object.defineProperty(window, 'location', {
            value: { reload: vi.fn() },
            writable: true
        });
    });
    afterEach(() => vi.clearAllMocks());

    it('requires confirmation before deleting', () => {
        renderButton();
        // Idle: only the danger button, no API call yet.
        expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        // Confirming: prompt + yes/no, still no API call.
        expect(screen.getByText('¿Eliminar esta propiedad?')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sí, eliminar' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
        expect(softDeleteMock).not.toHaveBeenCalled();
    });

    it('calls softDelete with the accommodation id on confirm', async () => {
        softDeleteMock.mockResolvedValue({ ok: true, data: {} });
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
        await waitFor(() => expect(softDeleteMock).toHaveBeenCalledWith({ id: 'acc-1' }));
    });

    it('cancelling returns to idle without calling the API', () => {
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
        expect(softDeleteMock).not.toHaveBeenCalled();
    });

    it('shows an inline error when the API call fails', async () => {
        softDeleteMock.mockResolvedValue({ ok: false, error: 'boom' });
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                'No se pudo eliminar. Intentá de nuevo.'
            )
        );
    });
});
