/**
 * @file DeleteButton.test.tsx
 * @description The "Eliminar" island must: render the danger button, require an
 * inline confirmation, call the protected delete endpoint with the listing id
 * AND the right vertical on confirm, and surface an inline error on API failure.
 * This is the owner-facing entry point that exercises SPEC-230 (soft-deleted
 * rows leave the owner's protected list).
 *
 * HOS-1156 T-015 added the vertical. The last two cases below are the ones that
 * matter for AC-14: the panel on a gastronomy publish page must delete a
 * gastronomy draft, and the default must stay accommodation so PropertyCard —
 * which passes no vertical at all — keeps its previous behaviour.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteButton } from '../../../src/components/host/DeleteButton.client';
import type { PublishVerticalSlug } from '../../../src/lib/api/endpoints-protected';

vi.mock('../../../src/components/host/UnpublishButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

const deleteDraftMock = vi.fn();
vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    publishApi: {
        deleteDraft: (args: { vertical: string; id: string }) => deleteDraftMock(args)
    }
}));

const renderButton = (vertical?: PublishVerticalSlug) =>
    render(
        <DeleteButton
            listingId="listing-1"
            vertical={vertical}
            locale="es"
            label="Eliminar"
            confirmText="¿Eliminar esta propiedad?"
            confirmYes="Sí, eliminar"
            confirmNo="Cancelar"
            errorText="No se pudo eliminar. Intentá de nuevo."
        />
    );

describe('DeleteButton (owner soft-delete island)', () => {
    beforeEach(() => {
        deleteDraftMock.mockReset();
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
        expect(deleteDraftMock).not.toHaveBeenCalled();
    });

    it('cancelling returns to idle without calling the API', () => {
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
        expect(deleteDraftMock).not.toHaveBeenCalled();
    });

    it('shows an inline error when the API call fails', async () => {
        deleteDraftMock.mockResolvedValue({ ok: false, error: 'boom' });
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                'No se pudo eliminar. Intentá de nuevo.'
            )
        );
    });

    it('defaults to the accommodation vertical when the caller passes none', async () => {
        deleteDraftMock.mockResolvedValue({ ok: true, data: {} });
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
        await waitFor(() =>
            expect(deleteDraftMock).toHaveBeenCalledWith({
                vertical: 'accommodation',
                id: 'listing-1'
            })
        );
    });

    for (const vertical of ['gastronomy', 'experience'] as const) {
        it(`deletes in the ${vertical} vertical when told to (AC-14)`, async () => {
            deleteDraftMock.mockResolvedValue({ ok: true, data: {} });
            renderButton(vertical);
            fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
            fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
            await waitFor(() =>
                expect(deleteDraftMock).toHaveBeenCalledWith({ vertical, id: 'listing-1' })
            );
        });
    }
});
