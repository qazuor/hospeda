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
const purgePreviewMock = vi.fn();
vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    publishApi: {
        purge: (args: { vertical: string; id: string }) => purgeMock(args),
        purgePreview: (args: { vertical: string; id: string }) => purgePreviewMock(args)
    }
}));

const previewWith = (lostAddons: readonly Record<string, unknown>[] = []) => ({
    ok: true as const,
    data: { lostAddons }
});

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
        purgePreviewMock.mockReset();
        purgePreviewMock.mockResolvedValue(previewWith());
        // Stub reload so the success path does not blow up the test environment.
        Object.defineProperty(window, 'location', {
            value: { reload: vi.fn() },
            writable: true
        });
    });
    afterEach(() => vi.clearAllMocks());

    it('requires confirmation before deleting', async () => {
        renderButton();
        // Idle: only the danger button, no API call yet.
        expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        // Confirming: prompt + yes/no, still no API call.
        expect(screen.getByText('¿Eliminar esta propiedad?')).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: 'Sí, eliminar' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
        expect(purgePreviewMock).toHaveBeenCalledWith({
            vertical: 'accommodation',
            id: 'listing-1'
        });
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
        fireEvent.click(await screen.findByRole('button', { name: 'Sí, eliminar' }));
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
        fireEvent.click(await screen.findByRole('button', { name: 'Sí, eliminar' }));
        await waitFor(() =>
            expect(purgeMock).toHaveBeenCalledWith({
                vertical: 'accommodation',
                id: 'listing-1'
            })
        );
    });

    for (const vertical of ['accommodation', 'venue', 'experience'] as const) {
        it(`runs PB12 in the ${vertical} vertical when told to (AC-14, AC:V6:25)`, async () => {
            purgeMock.mockResolvedValue({ ok: true, data: {} });
            renderButton(vertical);
            fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
            fireEvent.click(await screen.findByRole('button', { name: 'Sí, eliminar' }));
            await waitFor(() =>
                expect(purgeMock).toHaveBeenCalledWith({ vertical, id: 'listing-1' })
            );
        });
    }
});

describe('TEST:B13a:3c AC:B13a:4 the delete confirmation names the lost add-ons', () => {
    const oneAddon = {
        addonInstanceId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Fotos extra',
        chargeKind: 'PERIODICO',
        cycle: 'monthly',
        price: 250000,
        currency: 'ARS',
        status: 'ACTIVE',
        endsAt: null
    };

    beforeEach(() => {
        purgeMock.mockReset();
        purgePreviewMock.mockReset();
        purgePreviewMock.mockResolvedValue(previewWith());
    });

    it('shows an empty list without extra text and enables confirmation', async () => {
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

        const list = await screen.findByTestId('purge-lost-addons');
        expect(list).toHaveAttribute('data-count', '0');
        expect(list).toBeEmptyDOMElement();
        expect(
            screen.queryByText('Se pierden con la ficha, sin devolución:')
        ).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sí, eliminar' })).toBeEnabled();
    });

    it('lists two add-ons with names, centavo-converted amounts, and the title', async () => {
        purgePreviewMock.mockResolvedValue(
            previewWith([
                oneAddon,
                {
                    ...oneAddon,
                    addonInstanceId: '650e8400-e29b-41d4-a716-446655440000',
                    name: 'Destacado',
                    chargeKind: 'UNA_VEZ',
                    cycle: null,
                    status: 'PENDING_AUTHORIZATION',
                    endsAt: '2026-12-31T23:59:59.000Z'
                }
            ])
        );
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

        const list = await screen.findByTestId('purge-lost-addons');
        expect(list).toHaveAttribute('data-count', '2');
        expect(screen.getAllByTestId('purge-lost-addon')).toHaveLength(2);
        expect(list).toHaveTextContent('Fotos extra');
        expect(list).toHaveTextContent('Destacado');
        expect(list).toHaveTextContent(/\$\s?2\.500,00/);
        expect(screen.getByText('Se pierden con la ficha, sin devolución:')).toBeInTheDocument();
        expect(
            screen.getByText('El complemento no se pasa a otra ficha y su plazo sigue corriendo.')
        ).toBeInTheDocument();
    });

    it('keeps confirmation disabled on preview error and enables it after retry succeeds', async () => {
        purgePreviewMock
            .mockResolvedValueOnce({ ok: false, error: 'read failed' })
            .mockResolvedValueOnce(previewWith([oneAddon]));
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'No pudimos leer los complementos de esta ficha. Probá de nuevo antes de eliminarla.'
        );
        expect(screen.getByRole('button', { name: 'Sí, eliminar' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Sí, eliminar' })).toBeEnabled()
        );
        expect(purgePreviewMock).toHaveBeenCalledTimes(2);
    });

    it('keeps confirmation disabled and busy while the preview is loading', async () => {
        let resolvePreview: ((value: ReturnType<typeof previewWith>) => void) | undefined;
        purgePreviewMock.mockReturnValue(
            new Promise((resolve) => {
                resolvePreview = resolve;
            })
        );
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

        const confirm = screen.getByRole('button', { name: 'Sí, eliminar' });
        expect(confirm).toBeDisabled();
        expect(confirm).toHaveAttribute('aria-busy', 'true');
        resolvePreview?.(previewWith());
        await waitFor(() => expect(confirm).toBeEnabled());
    });

    it('cancels an in-flight preview result when the user leaves confirmation', async () => {
        let resolvePreview: ((value: ReturnType<typeof previewWith>) => void) | undefined;
        purgePreviewMock.mockReturnValue(
            new Promise((resolve) => {
                resolvePreview = resolve;
            })
        );
        renderButton();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        resolvePreview?.(previewWith([oneAddon]));

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
        );
        expect(screen.queryByTestId('purge-lost-addons')).not.toBeInTheDocument();
    });

    it('calls PB12 only after the loaded preview is confirmed', async () => {
        purgeMock.mockResolvedValue({ ok: true, data: {} });
        renderButton('experience');
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Sí, eliminar' }));

        await waitFor(() =>
            expect(purgeMock).toHaveBeenCalledWith({ vertical: 'experience', id: 'listing-1' })
        );
    });
});
