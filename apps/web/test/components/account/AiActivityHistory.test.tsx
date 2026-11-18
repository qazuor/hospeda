/**
 * @file AiActivityHistory.test.tsx
 * @description Tests for the assistant history island (HOS-2348, spec HOS-2335
 * §6.9). Renders with the real `es` translations so assertions read the
 * visible copy.
 *
 * Covers the empty state, an item with and without a link (AC-C47), the
 * `send`/`commit` equivalence, the reads toggle (D-12, AC-C50a), the result
 * filter, pagination, the error block and the no-raw-code rule (AC-C49).
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiActivityHistory } from '../../../src/components/account/AiActivityHistory.client';

vi.mock('../../../src/components/account/AiActivityHistory.module.css', () => ({
    default: new Proxy<Record<string, string>>(
        {},
        {
            get: (_target, prop) => String(prop)
        }
    )
}));

const API_URL = 'http://localhost:3001';
const CONNECT_URL = '/es/mi-cuenta/asistentes-ia/';
const SIGNIN_URL = '/es/auth/signin/?returnUrl=%2Fes%2Fmi-cuenta%2Fasistentes-ia%2Fhistorial%2F';
const LISTING = '11111111-1111-4111-8111-111111111111';

let sequence = 0;

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    sequence += 1;
    return {
        id: `cccccccc-cccc-4ccc-8ccc-${String(sequence).padStart(12, '0')}`,
        loggedAt: '2026-11-18T13:05:00.000Z',
        tool: 'update_listing_basic',
        isWrite: true,
        outcome: 'success',
        client: { id: 'client-claude', name: 'Claude' },
        ...overrides
    };
}

function page(
    items: readonly Record<string, unknown>[],
    pagination: { page?: number; totalPages?: number } = {}
): Response {
    return Response.json({
        success: true,
        data: {
            items,
            pagination: {
                page: pagination.page ?? 1,
                totalPages: pagination.totalPages ?? 1,
                total: items.length
            }
        }
    });
}

/** The n-th row; fails the test when it is not there. */
function row(index: number): HTMLElement {
    const found = screen.getAllByRole('listitem')[index];
    if (!found) throw new Error(`no row ${index}`);
    return found;
}

/** The URL of the n-th fetch, parsed. */
function requested(index: number): URL {
    const call = vi.mocked(fetch).mock.calls[index];
    return new URL(String(call?.[0]));
}

async function renderHistory(first: Response) {
    vi.mocked(fetch).mockResolvedValueOnce(first);
    render(
        <AiActivityHistory
            locale="es"
            apiUrl={API_URL}
            connectUrl={CONNECT_URL}
            signinUrl={SIGNIN_URL}
        />
    );
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
}

describe('AiActivityHistory', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('asks for writes only on load (D-12)', async () => {
        await renderHistory(page([]));

        expect(requested(0).searchParams.has('includeReads')).toBe(false);
        expect(requested(0).searchParams.get('page')).toBe('1');
        expect(vi.mocked(fetch).mock.calls[0]?.[1]).toEqual({ credentials: 'include' });
    });

    it('shows the empty state with the connect link when there is nothing', async () => {
        await renderHistory(page([]));

        expect(screen.getByText('Todavía no hay acciones de tus asistentes')).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Cómo conectar un asistente' }).getAttribute('href')
        ).toBe(CONNECT_URL);
    });

    it('lists an item with its action, assistant, result and linked listing', async () => {
        const url = `https://hospeda.test/es/mi-cuenta/propiedades/${LISTING}/editar/`;
        await renderHistory(
            page([
                item({
                    target: { type: 'accommodation', id: LISTING, label: 'Casa del Río', url }
                })
            ])
        );

        const first = row(0);
        expect(within(first).getByText('Editar los datos de una publicación')).toBeTruthy();
        expect(within(first).getByText('Claude')).toBeTruthy();
        expect(within(first).getByText('Hecho')).toBeTruthy();
        expect(within(first).getByRole('link', { name: 'Casa del Río' }).getAttribute('href')).toBe(
            url
        );
        expect(within(first).getByText(/2026/).tagName).toBe('TIME');
    });

    it('shows a lost listing with no name and no link (AC-C47)', async () => {
        await renderHistory(page([item({ target: { type: 'accommodation', id: LISTING } })]));

        const first = row(0);
        expect(within(first).queryByRole('link')).toBeNull();
        expect(within(first).getByText('Publicación que ya no está disponible')).toBeTruthy();
        expect(first.textContent).not.toContain(LISTING);
    });

    it('reads a conversation as "Consulta de huésped", linked to the inbox thread', async () => {
        await renderHistory(
            page([
                item({
                    tool: 'reply_inquiry',
                    step: 'commit',
                    target: { type: 'conversation', id: 'c-1', url: 'https://hospeda.test/c/' }
                })
            ])
        );

        const link = screen.getByRole('link', { name: /^Abrir la consulta de huésped de/ });
        expect(link.getAttribute('href')).toBe('https://hospeda.test/c/');
        expect(link.textContent).toBe('Consulta de huésped');
    });

    it('names each conversation link by its action and date, so two links differ (L1)', async () => {
        await renderHistory(
            page([
                item({
                    tool: 'reply_inquiry',
                    loggedAt: '2026-11-18T13:05:00.000Z',
                    target: { type: 'conversation', id: 'c-1', url: 'https://hospeda.test/c/1' }
                }),
                item({
                    tool: 'get_inquiry',
                    isWrite: false,
                    loggedAt: '2026-11-17T09:00:00.000Z',
                    target: { type: 'conversation', id: 'c-2', url: 'https://hospeda.test/c/2' }
                })
            ])
        );

        const names = screen
            .getAllByRole('link')
            .map((link) => link.getAttribute('aria-label') ?? '');
        expect(names).toHaveLength(2);
        expect(names[0]).toContain('Responder una consulta');
        expect(names[1]).toContain('Ver una consulta');
        expect(names[0]).toMatch(/2026/);
        expect(names[0]).not.toBe(names[1]);
    });

    it('renders an old send step exactly like a commit step', async () => {
        await renderHistory(
            page([
                item({ tool: 'reply_inquiry', step: 'send' }),
                item({ tool: 'reply_inquiry', step: 'commit' }),
                item({ tool: 'reply_inquiry', step: 'preview' })
            ])
        );

        const [send, commit, preview] = [row(0), row(1), row(2)];
        expect(send.textContent?.replace(/\d/g, '')).toBe(commit.textContent?.replace(/\d/g, ''));
        expect(within(send).getByText('Confirmado')).toBeTruthy();
        expect(within(preview).getByText('Vista previa')).toBeTruthy();
    });

    it('labels refusals and errors, and never shows a raw tool name or code', async () => {
        await renderHistory(
            page([
                item({ outcome: 'denied', errorCode: 'ENTITLEMENT_REQUIRED' }),
                item({ outcome: 'denied', errorCode: 'USER_DECLINED' }),
                item({ outcome: 'error', errorCode: 'SOME_FUTURE_CODE', tool: 'some_future_tool' })
            ])
        );

        const [denied, declined, failed] = [row(0), row(1), row(2)];
        expect(within(denied).getByText('Rechazado por Hospeda')).toBeTruthy();
        expect(within(denied).getByText('Tu plan no incluye esa función.')).toBeTruthy();
        expect(within(declined).getByText('Rechazado por vos')).toBeTruthy();
        expect(within(failed).getByText('Error')).toBeTruthy();
        expect(within(failed).getByText('Otra acción del asistente')).toBeTruthy();
        const text = document.body.textContent ?? '';
        expect(text).not.toMatch(
            /ENTITLEMENT_REQUIRED|USER_DECLINED|SOME_FUTURE_CODE|some_future_tool/
        );
    });

    it('renders the rest when an item has an unknown key, outcome or shape (M2)', async () => {
        await renderHistory(
            page([
                item({ client: { id: 'client-claude', name: 'Claude', version: '2' } }),
                item({ outcome: 'cancelled_by_policy', tool: 'get_listing', isWrite: false }),
                { id: 'broken' }
            ])
        );

        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(within(row(0)).getByText('Hecho')).toBeTruthy();
        expect(within(row(1)).getByText('Resultado desconocido')).toBeTruthy();
        expect(document.body.textContent).not.toContain('cancelled_by_policy');
    });

    it('refetches page 1 with includeReads=true when the toggle is turned on', async () => {
        await renderHistory(page([item()], { page: 1, totalPages: 1 }));
        vi.mocked(fetch).mockResolvedValueOnce(
            page([item({ tool: 'get_listing', isWrite: false })])
        );

        const toggle = screen.getByRole('checkbox', { name: 'Mostrar también lo que solo miró' });
        expect(toggle.getAttribute('aria-describedby')).toBeTruthy();
        expect(
            document.getElementById(toggle.getAttribute('aria-describedby') ?? '')?.textContent
        ).toBe('Acciones en las que el asistente solo vio datos, sin cambiar nada.');
        fireEvent.click(toggle);

        await waitFor(() => expect(screen.getByText('Ver una publicación')).toBeTruthy());
        expect(requested(1).searchParams.get('includeReads')).toBe('true');
        expect(requested(1).searchParams.get('page')).toBe('1');
    });

    it('filters by result and says so when nothing matches', async () => {
        await renderHistory(page([item()]));
        vi.mocked(fetch).mockResolvedValueOnce(page([]));

        fireEvent.change(screen.getByRole('combobox', { name: 'Resultado' }), {
            target: { value: 'error' }
        });

        await waitFor(() =>
            expect(screen.getByText('No hay acciones que coincidan con este filtro.')).toBeTruthy()
        );
        expect(requested(1).searchParams.get('outcome')).toBe('error');
    });

    it('pages forward and back', async () => {
        await renderHistory(page([item()], { page: 1, totalPages: 2 }));
        vi.mocked(fetch).mockResolvedValueOnce(page([item()], { page: 2, totalPages: 2 }));

        fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

        await waitFor(() => expect(screen.getByText('2 / 2')).toBeTruthy());
        expect(requested(1).searchParams.get('page')).toBe('2');
        expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveProperty('disabled', true);

        vi.mocked(fetch).mockResolvedValueOnce(page([item()], { page: 1, totalPages: 2 }));
        fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
        await waitFor(() => expect(screen.getByText('1 / 2')).toBeTruthy());
        expect(requested(2).searchParams.get('page')).toBe('1');
    });

    it('shows no pagination on a single page', async () => {
        await renderHistory(page([item()]));

        expect(screen.queryByRole('navigation')).toBeNull();
    });

    it('goes back to the last page when a later page comes back empty', async () => {
        await renderHistory(page([item()], { page: 1, totalPages: 3 }));
        vi.mocked(fetch).mockResolvedValueOnce(page([item()], { page: 2, totalPages: 3 }));
        fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
        await waitFor(() => expect(screen.getByText('2 / 3')).toBeTruthy());

        // The history shrank to one page while the user paged.
        vi.mocked(fetch).mockResolvedValueOnce(page([], { page: 3, totalPages: 1 }));
        vi.mocked(fetch).mockResolvedValueOnce(page([item()], { page: 1, totalPages: 1 }));
        fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

        await waitFor(() => expect(requested(3).searchParams.get('page')).toBe('1'));
        await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
        expect(screen.queryByText('Todavía no hay acciones de tus asistentes')).toBeNull();
    });

    it('offers to sign in again on a 401, not to retry', async () => {
        await renderHistory(Response.json({}, { status: 401 }));

        expect(screen.getByRole('alert').textContent).toContain('Tu sesión terminó');
        expect(screen.getByRole('link', { name: 'Ingresar' }).getAttribute('href')).toBe(
            SIGNIN_URL
        );
        expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    });

    it('shows the error block and retries', async () => {
        await renderHistory(Response.json({}, { status: 500 }));
        expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar el historial');

        vi.mocked(fetch).mockResolvedValueOnce(page([item()]));
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

        await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    });
});
