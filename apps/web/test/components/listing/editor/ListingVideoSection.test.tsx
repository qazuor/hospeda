import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingVideoSection } from '@/components/listing/editor/ListingVideoSection.client';

const { patchMock } = vi.hoisted(() => ({ patchMock: vi.fn() }));

vi.mock('@/lib/api/client', () => ({ apiClient: { patch: patchMock } }));
vi.mock('@/lib/forms/use-unsaved-changes-guard', () => ({ useUnsavedChangesGuard: vi.fn() }));
vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));
vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) =>
            Object.entries(params ?? {}).reduce(
                (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
                fallback ?? key
            )
    })
}));

const mount = () =>
    render(
        <ListingVideoSection
            locale="es"
            vertical="venue"
            listingId="venue-1"
            initialVideos={[]}
        />
    );

async function addAndSubmit(url: string) {
    fireEvent.click(screen.getByRole('button', { name: 'Agregar video' }));
    fireEvent.change(screen.getByLabelText('Enlace del video'), { target: { value: url } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar videos' }));
}

describe('ListingVideoSection (HOS-2258)', () => {
    beforeEach(() => {
        patchMock.mockReset();
    });

    it('PATCHes the venue endpoint with a top-level videos array (no media wrapper)', async () => {
        patchMock.mockResolvedValue({ ok: true });
        mount();

        await addAndSubmit('https://youtu.be/dQw4w9WgXcQ');

        await waitFor(() => expect(patchMock).toHaveBeenCalledTimes(1));
        expect(patchMock).toHaveBeenCalledWith({
            path: '/api/v1/protected/venues/venue-1',
            body: { videos: [{ url: 'https://youtu.be/dQw4w9WgXcQ' }] }
        });
    });

    it('answers a clear message on a 403 and stores nothing', async () => {
        patchMock.mockResolvedValue({ ok: false, error: { status: 403 } });
        mount();

        await addAndSubmit('https://youtu.be/dQw4w9WgXcQ');

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Tu plan no incluye videos. No se guardó nada.'
        );
    });

    it('stops adding rows at six', () => {
        mount();
        for (let i = 0; i < 6; i += 1) {
            fireEvent.click(screen.getByRole('button', { name: 'Agregar video' }));
        }

        expect(screen.getByRole('button', { name: 'Agregar video' })).toBeDisabled();
    });
});
