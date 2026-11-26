/**
 * @file AiAssistantsPanel.test.tsx
 * @description Tests for the "Asistentes de IA" island (HOS-2184 T-028).
 * Renders with the real `es` translations so assertions read the visible copy.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAssistantsPanel } from '../../../src/components/account/AiAssistantsPanel.client';

const API_URL = 'http://localhost:3001';
const MCP_URL = 'https://api.hospeda.com.ar/mcp';

const CLAUDE = {
    clientId: 'client-claude',
    name: 'Claude',
    uri: 'https://claude.ai/about',
    logoUri: 'https://evil.example/logo.png',
    scopes: ['openid'],
    connectedAt: '2026-11-01T10:00:00.000Z',
    lastUsedAt: '2026-11-10T10:00:00.000Z'
};

const URL_ID = {
    clientId: 'https://chat.example/client.json',
    name: null,
    uri: null,
    logoUri: null,
    scopes: [],
    connectedAt: '2026-11-02T10:00:00.000Z',
    lastUsedAt: null
};

function listResponse(items: readonly object[]): Response {
    return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { items } })
    } as Response;
}

function status(code: number): Response {
    return { ok: code >= 200 && code < 300, status: code, json: async () => ({}) } as Response;
}

const ACCESS_URL = `${API_URL}/api/v1/protected/ai-connections/access`;

function accessResponse(data: object): Response {
    return { ok: true, status: 200, json: async () => ({ success: true, data }) } as Response;
}

/** Calls that are not the access check (the check is a second, independent fetch). */
function nonAccessCalls() {
    return vi.mocked(fetch).mock.calls.filter(([url]) => url !== ACCESS_URL);
}

async function renderPanel({
    items,
    mcpUrl = MCP_URL
}: {
    readonly items: readonly object[];
    readonly mcpUrl?: string | null;
}) {
    vi.mocked(fetch).mockResolvedValueOnce(listResponse(items));
    render(
        <AiAssistantsPanel
            locale="es"
            apiUrl={API_URL}
            mcpUrl={mcpUrl}
        />
    );
    await waitFor(() => expect(screen.queryByText(/Cargando tus asistentes/)).toBeNull());
}

describe('AiAssistantsPanel', () => {
    beforeEach(() => {
        // The access check goes by URL; unless a test sets it, it fails (silent).
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => {
                if (url === ACCESS_URL) {
                    throw new Error('offline');
                }
                return undefined as unknown as Response;
            })
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('lists the connections with date and approximate last use', async () => {
        await renderPanel({ items: [CLAUDE, URL_ID] });

        expect(screen.getByText('Claude')).toBeTruthy();
        expect(screen.getByText('Asistente sin nombre')).toBeTruthy();
        expect(screen.getAllByText(/Conectado el/)).toHaveLength(2);
        expect(screen.getByText(/Último uso aprox\./)).toBeTruthy();
        expect(screen.getByText('Sin uso registrado')).toBeTruthy();
        expect(nonAccessCalls()[0]?.[0]).toBe(`${API_URL}/api/v1/protected/ai-connections`);
    });

    it('shows the MCP URL, the capabilities and the empty state when the flag is on', async () => {
        await renderPanel({ items: [] });

        expect(screen.getByDisplayValue(MCP_URL)).toBeTruthy();
        expect(screen.getByText('Ver tus publicaciones y sus estadísticas')).toBeTruthy();
        expect(screen.getByText('Responder consultas de tus alojamientos')).toBeTruthy();
        expect(
            screen.getByText(
                'Ver todas las reseñas de tus publicaciones, también las pendientes y las rechazadas'
            )
        ).toBeTruthy();
        expect(screen.getByText('Crear borradores de publicaciones nuevas')).toBeTruthy();
        expect(
            screen.getByText('Buscar en el directorio de proveedores para anfitriones')
        ).toBeTruthy();
        expect(
            screen.getByText('Ver tus usos de beneficios y confirmarlos o rechazarlos')
        ).toBeTruthy();
        expect(screen.getByText('Todavía no conectaste ningún asistente.')).toBeTruthy();
    });

    it('copies the MCP URL', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        await renderPanel({ items: [] });

        fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));

        // The kit CopyField announces the result in a polite live region
        await waitFor(() =>
            expect(screen.getByRole('status').textContent).toBe('Copiado al portapapeles.')
        );
        expect(writeText).toHaveBeenCalledWith(MCP_URL);
    });

    it('renders an untrusted name as text and never as HTML or an image', async () => {
        const hostile = { ...CLAUDE, name: '<img src=x onerror=alert(1)><b>boom</b>' };
        await renderPanel({ items: [hostile] });

        expect(screen.getByText('<img src=x onerror=alert(1)><b>boom</b>')).toBeTruthy();
        expect(document.querySelector('img')).toBeNull();
        expect(document.querySelector('b')).toBeNull();
    });

    it('links the client URI only when it is https', async () => {
        await renderPanel({
            items: [CLAUDE, { ...URL_ID, clientId: 'c2', name: 'Evil', uri: 'javascript:alert(1)' }]
        });

        const link = screen.getByRole('link', { name: 'claude.ai' });
        expect(link.getAttribute('href')).toBe('https://claude.ai/about');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer nofollow');
        expect(screen.getAllByRole('link')).toHaveLength(1);
    });

    it('asks for confirmation in a dialog, then DELETEs with the encoded id and removes the row', async () => {
        await renderPanel({ items: [URL_ID, CLAUDE] });
        vi.mocked(fetch).mockResolvedValueOnce(status(204));

        fireEvent.click(screen.getByRole('button', { name: 'Desconectar Asistente sin nombre' }));
        // Nothing is sent until the user confirms.
        expect(nonAccessCalls()).toHaveLength(1);
        expect(screen.getByText('¿Desconectar a Asistente sin nombre?')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Sí, desconectar' }));

        await waitFor(() => expect(screen.queryByText('Asistente sin nombre')).toBeNull());
        const [url, init] = nonAccessCalls()[1] ?? [];
        expect(url).toBe(
            `${API_URL}/api/v1/protected/ai-connections?clientId=https%3A%2F%2Fchat.example%2Fclient.json`
        );
        expect((init as RequestInit).method).toBe('DELETE');
        expect(screen.getByText('Claude')).toBeTruthy();
    });

    it('cancels the confirmation without calling the API', async () => {
        await renderPanel({ items: [CLAUDE] });

        fireEvent.click(screen.getByRole('button', { name: 'Desconectar Claude' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(screen.getByRole('button', { name: 'Desconectar Claude' })).toBeTruthy();
        expect(nonAccessCalls()).toHaveLength(1);
    });

    it('rolls the row back in place and shows an error when the DELETE fails', async () => {
        await renderPanel({ items: [CLAUDE, URL_ID] });
        vi.mocked(fetch).mockResolvedValueOnce(status(500));

        fireEvent.click(screen.getByRole('button', { name: 'Desconectar Claude' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sí, desconectar' }));

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('No pudimos desconectar el asistente');
        const rows = within(
            screen.getByRole('region', { name: 'Asistentes conectados' })
        ).getAllByRole('listitem');
        expect(within(rows[0] as HTMLElement).getByText('Claude')).toBeTruthy();
        expect(rows).toHaveLength(2);
    });

    it('treats a 404 on DELETE as already disconnected', async () => {
        await renderPanel({ items: [CLAUDE] });
        vi.mocked(fetch).mockResolvedValueOnce(status(404));

        fireEvent.click(screen.getByRole('button', { name: 'Desconectar Claude' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sí, desconectar' }));

        await waitFor(() =>
            expect(screen.getByText('Todavía no conectaste ningún asistente.')).toBeTruthy()
        );
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('shows a retryable error when the list cannot be loaded', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(status(500));
        render(
            <AiAssistantsPanel
                locale="es"
                apiUrl={API_URL}
                mcpUrl={MCP_URL}
            />
        );

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('No pudimos cargar tus asistentes');

        vi.mocked(fetch).mockResolvedValueOnce(listResponse([CLAUDE]));
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(await screen.findByText('Claude')).toBeTruthy();
    });

    describe('visibility (flag x connections)', () => {
        it('flag off with connections: list to disconnect, no connect instructions', async () => {
            await renderPanel({ items: [CLAUDE], mcpUrl: null });

            expect(screen.getByText('Claude')).toBeTruthy();
            expect(screen.getByText(/pausada por ahora/)).toBeTruthy();
            expect(screen.queryByText('Cómo conectar un asistente')).toBeNull();
            expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull();
        });

        it('flag off without connections: only an unavailable notice', async () => {
            await renderPanel({ items: [], mcpUrl: null });

            expect(screen.getByText(/todavía no está disponible/)).toBeTruthy();
            expect(screen.queryByText('Asistentes conectados')).toBeNull();
            expect(screen.queryByText('Cómo conectar un asistente')).toBeNull();
        });

        it('flag on without connections: instructions plus empty list', async () => {
            await renderPanel({ items: [] });

            expect(screen.getByText('Cómo conectar un asistente')).toBeTruthy();
            expect(screen.getByText('Asistentes conectados')).toBeTruthy();
        });
    });

    describe('plan notice (T-041)', () => {
        /** Routes the access URL to `answer`; everything else uses the once-queue. */
        function mockAccess(answer: () => Promise<Response>) {
            const fallback = vi.mocked(fetch).getMockImplementation();
            vi.mocked(fetch).mockImplementation(async (url, init) =>
                url === ACCESS_URL ? answer() : (fallback?.(url, init) as Promise<Response>)
            );
        }

        const NOTICE = /no está incluido en tu plan actual/;

        it('links the vertical plans page when the plan does not include it', async () => {
            mockAccess(async () => accessResponse({ hasAccess: false, vertical: 'venue' }));
            await renderPanel({ items: [] });

            expect(await screen.findByText(NOTICE)).toBeTruthy();
            expect(screen.getByText(/sin costo extra, en todos los planes pagos/)).toBeTruthy();
            expect(screen.getByRole('link', { name: 'Ver planes' }).getAttribute('href')).toBe(
                '/es/planes/comer-y-salir/'
            );
        });

        it('falls back to the accommodation plans page without a vertical', async () => {
            mockAccess(async () => accessResponse({ hasAccess: false }));
            await renderPanel({ items: [] });

            await screen.findByText(NOTICE);
            expect(screen.getByRole('link', { name: 'Ver planes' }).getAttribute('href')).toBe(
                '/es/planes/anfitriones/'
            );
        });

        it('keeps listing and revoking existing connections when access is false', async () => {
            mockAccess(async () => accessResponse({ hasAccess: false, vertical: 'accommodation' }));
            await renderPanel({ items: [CLAUDE] });

            await screen.findByText(NOTICE);
            expect(screen.getByText('Claude')).toBeTruthy();
            expect(screen.getByRole('button', { name: 'Desconectar Claude' })).toBeTruthy();
        });

        it('shows no notice when the plan includes the assistant', async () => {
            const answered = vi.fn(async () => accessResponse({ hasAccess: true }));
            mockAccess(answered);
            await renderPanel({ items: [] });

            await waitFor(() => expect(answered).toHaveBeenCalled());
            expect(screen.queryByText(NOTICE)).toBeNull();
        });

        it('shows no notice, and does not block the panel, when the check fails', async () => {
            await renderPanel({ items: [CLAUDE] });

            expect(screen.queryByText(NOTICE)).toBeNull();
            expect(screen.getByText('Claude')).toBeTruthy();
        });

        it('shows no notice when the check answers an error status', async () => {
            mockAccess(async () => status(500));
            await renderPanel({ items: [] });

            await waitFor(() => expect(fetch).toHaveBeenCalledWith(ACCESS_URL, expect.anything()));
            expect(screen.queryByText(NOTICE)).toBeNull();
        });
    });
});
