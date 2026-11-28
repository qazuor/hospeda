/**
 * @file PublishReadyDialog.qr-notice.test.tsx
 * @description HOS-2688: publishing from the editor's "your listing is ready"
 * dialog queues the one-time QR notice for the page the redirect lands on,
 * exactly like the card's publish button. A refused publish queues nothing.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishReadyDialog } from '@/components/host/editor/PublishReadyDialog.client';
import { LISTING_QR_NOTICE_STORAGE_KEY } from '@/lib/listing/listing-qr-page';

const publishMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { publish: publishMock }
}));

const PENDING_TOAST_KEY = 'hospeda.pendingToast';
const location = { href: '' };

function pendingToast(): unknown {
    const raw = window.sessionStorage.getItem(PENDING_TOAST_KEY);
    return raw === null ? null : JSON.parse(raw);
}

async function publish() {
    const user = userEvent.setup();
    const view = render(
        <PublishReadyDialog
            isOpen
            onClose={vi.fn()}
            locale="es"
            accommodationId="acc-7"
            startsTrial={false}
            trialDays={30}
        />
    );
    await user.click(screen.getByText('Publicar ahora'));
    await waitFor(() => expect(publishMock).toHaveBeenCalled());
    return view;
}

beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    location.href = '';
    vi.stubGlobal('location', location);
    publishMock.mockResolvedValue({ ok: true, data: {} });
});

afterEach(() => vi.unstubAllGlobals());

describe('PublishReadyDialog — HOS-2688 one-time QR notice', () => {
    it('queues the notice linking to the accommodation QR page, then redirects', async () => {
        await publish();

        await waitFor(() => expect(location.href).toBe('/es/mi-cuenta/propiedades/'));
        expect(pendingToast()).toMatchObject({
            type: 'success',
            message: '¡Tu ficha ya está publicada! Ya tenés tu código QR para imprimir.',
            action: {
                label: 'Ver mi código QR',
                href: '/es/mi-cuenta/propiedades/acc-7/codigo-qr/'
            }
        });
        expect(
            JSON.parse(window.localStorage.getItem(LISTING_QR_NOTICE_STORAGE_KEY) ?? '[]')
        ).toEqual(['acc-7']);
    });

    it('queues nothing the second time the same listing is published', async () => {
        const first = await publish();
        await waitFor(() => expect(location.href).not.toBe(''));
        first.unmount();
        window.sessionStorage.clear();

        await publish();

        await waitFor(() => expect(location.href).not.toBe(''));
        expect(pendingToast()).toBeNull();
    });

    it('queues nothing when the publish is refused', async () => {
        publishMock.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR' }
        });

        await publish();

        expect(location.href).toBe('');
        expect(pendingToast()).toBeNull();
        expect(window.localStorage.getItem(LISTING_QR_NOTICE_STORAGE_KEY)).toBeNull();
    });
});
