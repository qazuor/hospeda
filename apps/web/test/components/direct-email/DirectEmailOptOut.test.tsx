/**
 * @file DirectEmailOptOut.test.tsx
 * @description RTL tests for the direct email opt-out island (HOS-2685).
 * Loading the page must only READ; the write happens on click.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectEmailOptOut } from '../../../src/components/direct-email/DirectEmailOptOut.client';

vi.mock('../../../src/lib/i18n', async () => {
    const { tFromCatalog } = await import('../../helpers/i18n-catalog');
    return { createTranslations: (_locale: string) => ({ t: tFromCatalog }) };
});

vi.mock('../../../src/components/direct-email/DirectEmailOptOut.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/env', () => ({ getApiUrl: () => 'http://localhost:3001' }));

const OPT_OUT = 'http://localhost:3001/api/v1/public/direct-emails/opt-out';

function jsonResponse({ status, body }: { status: number; body: unknown }) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('DirectEmailOptOut', () => {
    it('only GETs on load, never writes, and shows the masked address', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            jsonResponse({
                status: 200,
                body: { success: true, data: { maskedEmail: 'a***@x.com' } }
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        render(
            <DirectEmailOptOut
                token="tok en"
                locale="es"
            />
        );

        expect(await screen.findByText(/a\*\*\*@x\.com/)).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${OPT_OUT}?token=tok%20en`);
        expect(init.method).toBe('GET');
    });

    it('POSTs the token on click and shows the success state', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                jsonResponse({ status: 200, body: { data: { maskedEmail: 'a***@x.com' } } })
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    status: 200,
                    body: { data: { maskedEmail: 'a***@x.com', suppressed: true } }
                })
            );
        vi.stubGlobal('fetch', fetchMock);
        render(
            <DirectEmailOptOut
                token="tok"
                locale="es"
            />
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Confirmar baja' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
        expect(url).toBe(OPT_OUT);
        expect(init.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({ token: 'tok' });
        expect(await screen.findByText('Listo, te dimos de baja')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Confirmar baja' })).not.toBeInTheDocument();
    });

    it('shows the invalid state, without calling the API, when there is no token', () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        render(
            <DirectEmailOptOut
                token=""
                locale="es"
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent('Este enlace no es válido');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shows the invalid state when the API rejects the token with 400', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                jsonResponse({
                    status: 400,
                    body: { success: false, error: { reason: 'DIRECT_EMAIL_TOKEN_INVALID' } }
                })
            )
        );

        render(
            <DirectEmailOptOut
                token="bad"
                locale="es"
            />
        );

        expect(await screen.findByRole('alert')).toHaveTextContent('Este enlace no es válido');
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows a retryable error when the confirmation request fails, keeping the button', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                jsonResponse({ status: 200, body: { data: { maskedEmail: 'a***@x.com' } } })
            )
            .mockRejectedValueOnce(new Error('offline'));
        vi.stubGlobal('fetch', fetchMock);
        render(
            <DirectEmailOptOut
                token="tok"
                locale="es"
            />
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Confirmar baja' }));

        expect(
            await screen.findByText('No pudimos completar la baja. Probá de nuevo en un momento.')
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Confirmar baja' })).toBeEnabled();
    });

    it('shows the network error without a button when the first read fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

        render(
            <DirectEmailOptOut
                token="tok"
                locale="es"
            />
        );

        expect(
            await screen.findByText('No pudimos completar la baja. Probá de nuevo en un momento.')
        ).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows the retryable error, not "invalid link", when the read is rate limited (429)', async () => {
        // Regression: every 4xx used to be read as a rejected token.
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 429, body: {} })));

        render(
            <DirectEmailOptOut
                token="tok"
                locale="es"
            />
        );

        expect(
            await screen.findByText('No pudimos completar la baja. Probá de nuevo en un momento.')
        ).toBeInTheDocument();
        expect(screen.queryByText('Este enlace no es válido')).not.toBeInTheDocument();
    });

    it('keeps the confirm button when the POST is rate limited (429)', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                jsonResponse({ status: 200, body: { data: { maskedEmail: 'a***@x.com' } } })
            )
            .mockResolvedValueOnce(jsonResponse({ status: 429, body: {} }));
        vi.stubGlobal('fetch', fetchMock);
        render(
            <DirectEmailOptOut
                token="tok"
                locale="es"
            />
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Confirmar baja' }));

        expect(
            await screen.findByText('No pudimos completar la baja. Probá de nuevo en un momento.')
        ).toBeInTheDocument();
        expect(screen.queryByText('Este enlace no es válido')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Confirmar baja' })).toBeEnabled();
    });

    it('removes the token from the address bar after reading it', async () => {
        window.history.replaceState(null, '', '/es/correos/baja/?token=tok&utm=1#top');
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    jsonResponse({ status: 200, body: { data: { maskedEmail: 'a***@x.com' } } })
                )
        );

        render(
            <DirectEmailOptOut
                token="tok"
                locale="es"
            />
        );

        await screen.findByText(/a\*\*\*@x\.com/);
        expect(window.location.search).toBe('?utm=1');
        expect(window.location.href).not.toContain('token=');
        expect(window.location.hash).toBe('#top');
    });
});
