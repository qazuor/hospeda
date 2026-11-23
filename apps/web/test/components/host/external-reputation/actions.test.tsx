/**
 * @file actions.test.tsx
 * @description Persisting actions of the external reputation section (HOS-2515):
 * master toggle, per-row flags, removal and refresh. Each one must reach the
 * editor's auto-save chip through `runEditorAutoSave` (saving, then saved or
 * error), keep its pre-HOS-2515 behaviour and ask before deleting.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    __resetEditorAutoSave,
    getEditorAutoSave,
    subscribeEditorAutoSave
} from '@/components/account/editor-shell/editor-auto-save-signal';
import { callsTo, LISTING_GOOGLE, META_OFF, renderSection, reply, routeFetch } from './fixtures';

const MASTER = 'Mostrar sección de reputación externa';

/** Records every chip status published while the test runs. */
function recordChip(): string[] {
    const seen: string[] = [];
    subscribeEditorAutoSave(() => seen.push(getEditorAutoSave().status));
    return seen;
}

/** Waits for the master switch to be usable. */
async function masterSwitch() {
    const toggle = await screen.findByRole('switch', { name: MASTER });
    await waitFor(() => expect(toggle).not.toBeDisabled());
    return toggle;
}

beforeEach(() => {
    __resetEditorAutoSave();
    vi.stubGlobal('fetch', vi.fn());
});

describe('master toggle', () => {
    it('PATCHes the body the route declares and reports saving then saved', async () => {
        routeFetch({ meta: META_OFF });
        renderSection();
        const toggle = await masterSwitch();
        const seen = recordChip();

        fireEvent.click(toggle);

        await waitFor(() => expect(getEditorAutoSave().status).toBe('saved'));
        expect(seen).toEqual(['saving', 'saved']);
        const [call] = callsTo({ part: '/external-reputation/master-toggle', method: 'PATCH' });
        expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ value: true });
        expect(toggle).toHaveAttribute('aria-checked', 'true');
    });

    it('reports an error, explains it and reverts the switch when the PATCH fails', async () => {
        routeFetch({
            meta: META_OFF,
            handler: (url, init) =>
                init.method === 'PATCH' && url.includes('master-toggle') ? reply(400) : undefined
        });
        renderSection();
        const toggle = await masterSwitch();

        fireEvent.click(toggle);

        await waitFor(() => expect(getEditorAutoSave().status).toBe('error'));
        expect(await screen.findByText(/No se pudo cambiar la visibilidad/)).toBeInTheDocument();
        await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    });
});

describe('per-listing flags', () => {
    it('PATCHes showLink off and reports saved', async () => {
        routeFetch({ listings: [LISTING_GOOGLE] });
        renderSection();
        const link = await screen.findByRole('switch', { name: 'Mostrar enlace a la plataforma' });
        const seen = recordChip();

        fireEvent.click(link);

        await waitFor(() => expect(getEditorAutoSave().status).toBe('saved'));
        expect(seen).toEqual(['saving', 'saved']);
        const [call] = callsTo({
            part: `/external-listings/${LISTING_GOOGLE.id}`,
            method: 'PATCH'
        });
        expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ showLink: false });
    });

    it('PATCHes showReviews on', async () => {
        routeFetch({ listings: [LISTING_GOOGLE] });
        renderSection();
        fireEvent.click(await screen.findByRole('switch', { name: 'Mostrar reseñas de texto' }));

        await waitFor(() =>
            expect(callsTo({ part: '/external-listings/', method: 'PATCH' })).toHaveLength(1)
        );
        const [call] = callsTo({ part: '/external-listings/', method: 'PATCH' });
        expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ showReviews: true });
    });

    it('reports an error and reverts the switch when the PATCH fails', async () => {
        routeFetch({
            listings: [LISTING_GOOGLE],
            handler: (_url, init) => (init.method === 'PATCH' ? reply(500) : undefined)
        });
        renderSection();
        const link = await screen.findByRole('switch', { name: 'Mostrar enlace a la plataforma' });

        fireEvent.click(link);

        await waitFor(() => expect(getEditorAutoSave().status).toBe('error'));
        await waitFor(() => expect(link).toHaveAttribute('aria-checked', 'true'));
    });
});

describe('remove listing', () => {
    const openDialog = async () => {
        renderSection();
        fireEvent.click(await screen.findByRole('button', { name: 'Eliminar Google' }));
        return screen.findByRole('alertdialog');
    };
    const deleteCalls = () =>
        callsTo({ part: `/external-listings/${LISTING_GOOGLE.id}`, method: 'DELETE' });

    it('asks for confirmation first and sends nothing yet (HOS-794)', async () => {
        routeFetch();
        const confirmSpy = vi.spyOn(window, 'confirm');
        await openDialog();

        expect(
            screen.getByText(/¿Eliminás esta plataforma\? Se dejan de mostrar sus reseñas/)
        ).toBeInTheDocument();
        expect(deleteCalls()).toHaveLength(0);
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(getEditorAutoSave().status).toBe('idle');
        confirmSpy.mockRestore();
    });

    it('sends nothing when the confirmation is cancelled', async () => {
        routeFetch();
        await openDialog();
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(deleteCalls()).toHaveLength(0);
        expect(screen.getByRole('button', { name: 'Eliminar Google' })).toBeInTheDocument();
    });

    it('DELETEs once confirmed, drops the row and reports saved', async () => {
        routeFetch();
        await openDialog();
        const seen = recordChip();

        fireEvent.click(screen.getByRole('button', { name: 'Eliminar plataforma' }));

        await waitFor(() =>
            expect(
                screen.queryByRole('button', { name: 'Eliminar Google' })
            ).not.toBeInTheDocument()
        );
        expect(deleteCalls()).toHaveLength(1);
        expect(seen).toEqual(['saving', 'saved']);
    });

    it('keeps the row, explains itself and reports an error when the DELETE fails (HOS-794)', async () => {
        routeFetch({
            handler: (_url, init) => (init.method === 'DELETE' ? reply(500) : undefined)
        });
        await openDialog();

        fireEvent.click(screen.getByRole('button', { name: 'Eliminar plataforma' }));

        expect(await screen.findByText('No se pudo eliminar la plataforma.')).toBeInTheDocument();
        expect(getEditorAutoSave().status).toBe('error');
        expect(screen.getByRole('button', { name: 'Eliminar Google' })).toBeInTheDocument();
    });
});

describe('status polling after a 202', () => {
    it('shows the run status of each platform as a pill and keeps refresh disabled', async () => {
        routeFetch({
            handler: (url, init) => {
                if (init.method === 'POST' && url.includes('/refresh')) return reply(202);
                if (url.endsWith('/external-reputation/status')) {
                    return reply(200, {
                        success: true,
                        data: {
                            platforms: {
                                GOOGLE: {
                                    runStatus: 'running',
                                    fetchStatus: 'ok',
                                    rating: 4.5,
                                    reviewsCount: 10,
                                    aggregateFetchedAt: null
                                }
                            },
                            allSettled: false
                        }
                    });
                }
                return undefined;
            }
        });
        renderSection();
        const button = await screen.findByTestId('refresh-button');
        await waitFor(() => expect(button).not.toBeDisabled());

        fireEvent.click(button);

        expect(await screen.findByText('Procesando...')).toHaveAttribute('data-tone', 'info');
        expect(screen.getByTestId('refresh-button')).toBeDisabled();
    });
});

describe('refresh', () => {
    const refreshButton = () => screen.findByTestId('refresh-button');
    const refreshWith = (answer: () => Response) =>
        routeFetch({
            handler: (url, init) =>
                init.method === 'POST' && url.includes('/refresh') ? answer() : undefined
        });

    it('POSTs /refresh and reports saved on a 200 with work done', async () => {
        refreshWith(() =>
            reply(200, {
                data: { inlineSucceeded: ['GOOGLE'], enqueuedAsync: [], inlineFailed: [] }
            })
        );
        renderSection();
        const button = await refreshButton();
        await waitFor(() => expect(button).not.toBeDisabled());
        const seen = recordChip();

        fireEvent.click(button);

        expect(await screen.findByText('Actualizado')).toBeInTheDocument();
        expect(seen).toEqual(['saving', 'saved']);
        expect(callsTo({ part: '/external-reputation/refresh', method: 'POST' })).toHaveLength(1);
    });

    it('treats a 202 as an async enqueue and says so', async () => {
        refreshWith(() => reply(202));
        renderSection();
        const button = await refreshButton();
        await waitFor(() => expect(button).not.toBeDisabled());

        fireEvent.click(button);

        expect(await screen.findByText('Actualizando en segundo plano...')).toBeInTheDocument();
        expect(getEditorAutoSave().status).toBe('saved');
    });

    it('never says "Actualizado" when a 200 queried no platform (HOS-1944)', async () => {
        refreshWith(() =>
            reply(200, { data: { inlineSucceeded: [], enqueuedAsync: [], inlineFailed: [] } })
        );
        renderSection();
        const button = await refreshButton();
        await waitFor(() => expect(button).not.toBeDisabled());

        fireEvent.click(button);

        expect(await screen.findByTestId('refresh-no-platforms')).toBeInTheDocument();
        expect(screen.queryByText('Actualizado')).not.toBeInTheDocument();
    });

    it('reads the minutes from the 429 body and reports the chip as not done', async () => {
        refreshWith(() => reply(429, { error: { details: { retryAfter: 600 } } }));
        renderSection();
        const button = await refreshButton();
        await waitFor(() => expect(button).not.toBeDisabled());

        fireEvent.click(button);

        expect(await screen.findByTestId('rate-limit-msg')).toHaveTextContent(
            'Podés actualizar nuevamente en 10 minutos'
        );
        expect(getEditorAutoSave().status).toBe('error');
    });

    it('shows the refresh error and an error chip on a 500', async () => {
        refreshWith(() => reply(500));
        renderSection();
        const button = await refreshButton();
        await waitFor(() => expect(button).not.toBeDisabled());

        fireEvent.click(button);

        expect(await screen.findByText(/No se pudo actualizar la reputación/)).toBeInTheDocument();
        expect(getEditorAutoSave().status).toBe('error');
    });

    it('is disabled with an explanation while no platform is connected (HOS-1944)', async () => {
        routeFetch({ listings: [], meta: META_OFF });
        renderSection();

        expect(await screen.findByTestId('refresh-needs-platform')).toBeInTheDocument();
        expect(screen.getByTestId('refresh-button')).toBeDisabled();
    });

    it('does not claim a platform is needed while the listings are still loading', () => {
        vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));
        renderSection();
        expect(screen.queryByTestId('refresh-needs-platform')).not.toBeInTheDocument();
    });
});
