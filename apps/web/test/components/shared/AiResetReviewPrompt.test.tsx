/**
 * @file AiResetReviewPrompt.test.tsx
 * @description Tests for the post-password-reset AI assistants prompt (HOS-2184).
 * Renders with the real `es` translations so assertions read the visible copy.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiResetReviewPrompt } from '../../../src/components/shared/ai-assistants/AiResetReviewPrompt.client';
import { resetAiConnectionCount } from '../../../src/lib/ai-connections-count';

vi.mock('../../../src/components/shared/ai-assistants/AiResetReviewPrompt.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

const { readCachedAuthMeMock, fetchAuthMeMock, addToastMock } = vi.hoisted(() => ({
    readCachedAuthMeMock: vi.fn(),
    fetchAuthMeMock: vi.fn(),
    addToastMock: vi.fn()
}));

vi.mock('../../../src/lib/auth-cache', () => ({
    readCachedAuthMe: readCachedAuthMeMock,
    fetchAuthMe: fetchAuthMeMock
}));

vi.mock('../../../src/store/toast-store', () => ({ addToast: addToastMock }));

const API_URL = 'http://localhost:3001';
const LIST_URL = `${API_URL}/api/v1/protected/ai-connections`;
const REVIEW_URL = `${API_URL}/api/v1/protected/ai-connections/reset-review`;

const CONNECTION = {
    clientId: 'client-claude',
    name: 'Claude',
    uri: null,
    logoUri: null,
    scopes: ['openid'],
    connectedAt: '2026-11-01T10:00:00.000Z',
    lastUsedAt: null
};

function listResponse({ review }: { readonly review: readonly object[] | null }): Response {
    return {
        ok: true,
        status: 200,
        json: async () => ({
            success: true,
            data: {
                items: [CONNECTION],
                pendingResetReview:
                    review === null
                        ? null
                        : { resetAt: '2026-11-10T12:00:00.000Z', connectionsBeforeReset: review }
            }
        })
    } as Response;
}

function status(code: number): Response {
    return { ok: code >= 200 && code < 300, status: code, json: async () => ({}) } as Response;
}

function mount() {
    return render(
        <AiResetReviewPrompt
            locale="es"
            apiUrl={API_URL}
        />
    );
}

function postCalls() {
    return vi.mocked(fetch).mock.calls.filter(([url]) => url === REVIEW_URL);
}

describe('AiResetReviewPrompt', () => {
    beforeEach(() => {
        resetAiConnectionCount();
        vi.stubGlobal('fetch', vi.fn());
        readCachedAuthMeMock.mockReset().mockReturnValue({ isAuthenticated: true });
        fetchAuthMeMock.mockReset().mockResolvedValue({ isAuthenticated: false });
        addToastMock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('asks, with the count, when a review is pending', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            listResponse({ review: [CONNECTION, { ...CONNECTION, clientId: 'c2' }] })
        );

        mount();

        expect(
            await screen.findByText(/Cambiaste tu contraseña\. Tenés 2 asistentes de IA/)
        ).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Desconectar asistentes' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Mantenerlos' })).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Ver mis asistentes de IA' }).getAttribute('href')
        ).toBe('/es/mi-cuenta/asistentes-ia/');
        expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(LIST_URL);
    });

    it('uses the singular copy for one assistant', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(listResponse({ review: [CONNECTION] }));

        mount();

        expect(
            await screen.findByText(
                /Tenés 1 asistente de IA conectado desde antes\. ¿Querés desconectarlo también\?/
            )
        ).toBeTruthy();
    });

    it('has no way to dismiss it other than answering', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(listResponse({ review: [CONNECTION] }));

        mount();

        await screen.findByText(/Cambiaste tu contraseña/);
        expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
            'Desconectar asistentes',
            'Mantenerlos'
        ]);
    });

    it('renders nothing when no review is pending', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(listResponse({ review: null }));

        const { container } = mount();

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        expect(container.innerHTML).toBe('');
    });

    it('does not touch the connections endpoint for a guest', async () => {
        readCachedAuthMeMock.mockReturnValue({ isAuthenticated: false });

        const { container } = mount();

        await waitFor(() => expect(readCachedAuthMeMock).toHaveBeenCalled());
        expect(fetch).not.toHaveBeenCalled();
        expect(container.innerHTML).toBe('');
    });

    it('falls back to /auth/me when nothing is cached', async () => {
        readCachedAuthMeMock.mockReturnValue(null);
        fetchAuthMeMock.mockResolvedValue({ isAuthenticated: true });
        vi.mocked(fetch).mockResolvedValueOnce(listResponse({ review: [CONNECTION] }));

        mount();

        expect(await screen.findByText(/Cambiaste tu contraseña/)).toBeTruthy();
        expect(fetchAuthMeMock).toHaveBeenCalledWith({ apiUrl: API_URL });
    });

    it('renders nothing when the lookup fails', async () => {
        vi.mocked(fetch).mockRejectedValueOnce(new Error('down'));

        const { container } = mount();

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        expect(container.innerHTML).toBe('');
    });

    it('"Desconectar asistentes" posts revoke_previous, hides and confirms with a toast', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(listResponse({ review: [CONNECTION] }))
            .mockResolvedValueOnce(status(200));
        mount();

        fireEvent.click(await screen.findByRole('button', { name: 'Desconectar asistentes' }));

        await waitFor(() => expect(screen.queryByText(/Cambiaste tu contraseña/)).toBeNull());
        const [url, init] = postCalls()[0] ?? [];
        expect(url).toBe(REVIEW_URL);
        expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
        expect(JSON.parse((init as RequestInit).body as string)).toEqual({
            action: 'revoke_previous'
        });
        expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });

    it('"Mantenerlos" posts keep and hides without a toast', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(listResponse({ review: [CONNECTION] }))
            .mockResolvedValueOnce(status(200));
        mount();

        fireEvent.click(await screen.findByRole('button', { name: 'Mantenerlos' }));

        await waitFor(() => expect(screen.queryByText(/Cambiaste tu contraseña/)).toBeNull());
        expect(JSON.parse(postCalls()[0]?.[1]?.body as string)).toEqual({ action: 'keep' });
        expect(addToastMock).not.toHaveBeenCalled();
    });

    it('treats a 409 (already answered elsewhere) as done', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(listResponse({ review: [CONNECTION] }))
            .mockResolvedValueOnce(status(409));
        mount();

        fireEvent.click(await screen.findByRole('button', { name: 'Mantenerlos' }));

        await waitFor(() => expect(screen.queryByText(/Cambiaste tu contraseña/)).toBeNull());
    });

    it('shows an error and keeps both buttons usable when the answer fails', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(listResponse({ review: [CONNECTION] }))
            .mockResolvedValueOnce(status(500))
            .mockResolvedValueOnce(status(200));
        mount();

        fireEvent.click(await screen.findByRole('button', { name: 'Desconectar asistentes' }));

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('No pudimos guardar tu respuesta');
        expect(screen.getByText(/Cambiaste tu contraseña/)).toBeTruthy();
        const retry = screen.getByRole('button', { name: 'Desconectar asistentes' });
        expect((retry as HTMLButtonElement).disabled).toBe(false);

        fireEvent.click(retry);

        await waitFor(() => expect(screen.queryByText(/Cambiaste tu contraseña/)).toBeNull());
        expect(postCalls()).toHaveLength(2);
    });

    it('shows an error when the network drops', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(listResponse({ review: [CONNECTION] }))
            .mockRejectedValueOnce(new Error('offline'));
        mount();

        fireEvent.click(await screen.findByRole('button', { name: 'Mantenerlos' }));

        expect(await screen.findByRole('alert')).toBeTruthy();
    });

    it('disables both buttons while the answer is in flight', async () => {
        let release: (res: Response) => void = () => undefined;
        vi.mocked(fetch)
            .mockResolvedValueOnce(listResponse({ review: [CONNECTION] }))
            .mockReturnValueOnce(new Promise<Response>((resolve) => (release = resolve)));
        mount();

        fireEvent.click(await screen.findByRole('button', { name: 'Mantenerlos' }));

        await waitFor(() =>
            expect(
                (screen.getByRole('button', { name: 'Mantenerlos' }) as HTMLButtonElement).disabled
            ).toBe(true)
        );
        expect(
            (screen.getByRole('button', { name: 'Desconectar asistentes' }) as HTMLButtonElement)
                .disabled
        ).toBe(true);
        release(status(200));
        await waitFor(() => expect(screen.queryByText(/Cambiaste tu contraseña/)).toBeNull());
    });
});
