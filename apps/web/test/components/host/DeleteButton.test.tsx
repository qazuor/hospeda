/**
 * @file DeleteButton.test.tsx
 * @description The "Eliminar" island must: render the danger button, require an
 * inline confirmation, run PB12 (`publishApi.purge`) with the listing id AND the
 * right vertical on confirm, and surface an inline error on API failure.
 * HOS-1477 (AC:V6:25) made this button the delete of the design: PB12 on the
 * three verticals, the listing moves to `PURGED`.
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

const purgeMock = vi.fn();
vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    publishApi: {
        purge: (args: { vertical: string; id: string }) => purgeMock(args)
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

describe('DeleteButton (owner PB12 delete island)', () => {
    beforeEach(() => {
        purgeMock.mockReset();
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
        expect(purgeMock).not.toHaveBeenCalled();
    });

    it('cancelling returns to idle without calling the API', () => {
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
        expect(purgeMock).not.toHaveBeenCalled();
    });

    it('shows an inline error when the API call fails', async () => {
        purgeMock.mockResolvedValue({ ok: false, error: 'boom' });
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
        purgeMock.mockResolvedValue({ ok: true, data: {} });
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
        await waitFor(() =>
            expect(purgeMock).toHaveBeenCalledWith({
                vertical: 'accommodation',
                id: 'listing-1'
            })
        );
    });

    for (const vertical of ['accommodation', 'gastronomy', 'experience'] as const) {
        it(`runs PB12 in the ${vertical} vertical when told to (AC-14, AC:V6:25)`, async () => {
            purgeMock.mockResolvedValue({ ok: true, data: {} });
            renderButton(vertical);
            fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
            fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
            await waitFor(() =>
                expect(purgeMock).toHaveBeenCalledWith({ vertical, id: 'listing-1' })
            );
        });
    }
});
