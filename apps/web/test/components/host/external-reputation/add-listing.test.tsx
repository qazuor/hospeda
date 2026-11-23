/**
 * @file add-listing.test.tsx
 * @description The «add a platform» form of the external reputation section
 * (HOS-2515): kit fields, client-side URL validation (HOS-190), duplicate and
 * server errors, the platforms still available, the per-platform hint and the
 * DISTINCT busy and idle labels in es, en and pt (HOS-2438). The submit must
 * reach the editor's auto-save chip.
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    __resetEditorAutoSave,
    getEditorAutoSave
} from '@/components/account/editor-shell/editor-auto-save-signal';
import type { SupportedLocale } from '@/lib/i18n';
import {
    callsTo,
    LISTING_BOOKING,
    LISTING_GOOGLE,
    META_OFF,
    renderSection,
    reply,
    routeFetch
} from './fixtures';

const ALL_FOUR = ['GOOGLE', 'BOOKING', 'AIRBNB', 'OTHER'].map((platform, index) => ({
    ...LISTING_GOOGLE,
    id: `0000000${index}-0000-4000-8000-000000000000`,
    platform: platform as 'GOOGLE'
}));

/** The URL field, found by its visible label. */
const urlField = () => screen.findByLabelText(/Enlace público \(URL\)/);

beforeEach(() => {
    __resetEditorAutoSave();
    vi.stubGlobal('fetch', vi.fn());
});

describe('add listing form', () => {
    it('uses labelled kit fields: no placeholder as label, required marked by the kit', async () => {
        routeFetch({ listings: [], meta: META_OFF });
        renderSection();

        const url = await urlField();
        expect(url).toBeRequired();
        expect(screen.getByLabelText('Plataforma')).toBeInstanceOf(HTMLSelectElement);
        expect(screen.getByText('obligatorio', { exact: false })).toBeInTheDocument();
    });

    it('POSTs the filled form and reports saving then saved', async () => {
        routeFetch({ listings: [], meta: META_OFF });
        renderSection();
        fireEvent.change(await urlField(), {
            target: { value: 'https://maps.google.com/?cid=999' }
        });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar enlace a la plataforma' }));

        fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

        await waitFor(() => expect(getEditorAutoSave().status).toBe('saved'));
        const [call] = callsTo({ part: '/external-listings', method: 'POST' });
        expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
            platform: 'GOOGLE',
            url: 'https://maps.google.com/?cid=999',
            showLink: true,
            showReviews: false
        });
    });

    it('disables the add button while the URL is empty', async () => {
        routeFetch({ listings: [], meta: META_OFF });
        renderSection();
        await urlField();
        expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
    });

    it('rejects an invalid URL client-side, without POSTing or touching the chip (HOS-190)', async () => {
        routeFetch({ listings: [], meta: META_OFF });
        renderSection();
        fireEvent.change(await urlField(), { target: { value: 'csdcsdcsd' } });

        fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

        expect(
            await screen.findByText('Ingresá una URL válida (https://...).')
        ).toBeInTheDocument();
        expect(callsTo({ part: '/external-listings', method: 'POST' })).toHaveLength(0);
        expect(getEditorAutoSave().status).toBe('idle');
        expect(await urlField()).toHaveAttribute('aria-invalid', 'true');
    });

    it('maps DUPLICATE_PLATFORM (details.reason) to the friendly message and an error chip', async () => {
        routeFetch({
            listings: [],
            meta: META_OFF,
            handler: (_url, init) =>
                init.method === 'POST'
                    ? reply(400, {
                          error: {
                              message: 'raw server text',
                              details: { reason: 'DUPLICATE_PLATFORM' }
                          }
                      })
                    : undefined
        });
        renderSection();
        fireEvent.change(await urlField(), { target: { value: 'https://maps.google.com/?cid=1' } });

        fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

        expect(await screen.findByText(/Ya tenés un enlace de Google cargado/)).toBeInTheDocument();
        expect(screen.queryByText('raw server text')).not.toBeInTheDocument();
        expect(getEditorAutoSave().status).toBe('error');
    });

    it('shows the generic message and never leaks a raw 500 message', async () => {
        routeFetch({
            listings: [],
            meta: META_OFF,
            handler: (_url, init) =>
                init.method === 'POST'
                    ? reply(500, { error: { message: 'insert into "x" bind $1' } })
                    : undefined
        });
        renderSection();
        fireEvent.change(await urlField(), { target: { value: 'https://maps.google.com/?cid=1' } });

        fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

        expect(await screen.findByText(/No pudimos guardar el enlace/)).toBeInTheDocument();
        expect(screen.queryByText(/insert into/)).not.toBeInTheDocument();
    });

    it('prefers the server-authored user-friendly message', async () => {
        routeFetch({
            listings: [],
            meta: META_OFF,
            handler: (_url, init) =>
                init.method === 'POST'
                    ? reply(400, { error: { userFriendlyMessage: 'Esa URL no es de Google.' } })
                    : undefined
        });
        renderSection();
        fireEvent.change(await urlField(), { target: { value: 'https://example.com/x' } });

        fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

        expect(await screen.findByText('Esa URL no es de Google.')).toBeInTheDocument();
    });
});

describe('available platforms', () => {
    it('offers only the platforms with no listing yet', async () => {
        routeFetch({ listings: [LISTING_GOOGLE, LISTING_BOOKING] });
        renderSection();
        const select = await screen.findByLabelText('Plataforma');
        const options = within(select as HTMLElement).getAllByRole('option');
        expect(options.map((option) => option.textContent)).toEqual(['Airbnb', 'Otra plataforma']);
    });

    it('hides the form and explains when every platform is connected', async () => {
        routeFetch({ listings: ALL_FOUR });
        renderSection();
        expect(await screen.findByTestId('ext-rep-all-platforms')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Agregar' })).not.toBeInTheDocument();
    });
});

describe('per-platform URL hint', () => {
    it.each([
        ['GOOGLE', /Google Maps/],
        ['BOOKING', /extranet de Booking/],
        ['AIRBNB', /panel de anfitrión de Airbnb/],
        ['OTHER', /enlace público directo/]
    ])('shows the %s hint under the URL field', async (platform, hint) => {
        routeFetch({ listings: [], meta: META_OFF });
        renderSection();
        const select = await screen.findByLabelText('Plataforma');
        fireEvent.change(select, { target: { value: platform } });
        const url = await urlField();
        const hintId = url.getAttribute('aria-describedby') ?? '';
        expect(document.getElementById(hintId.split(' ')[0] ?? '')).toHaveTextContent(hint);
    });
});

describe('busy and idle labels are distinct (HOS-2438)', () => {
    const NEVER = new Promise<Response>(() => {});

    it.each<[SupportedLocale, string, string]>([
        ['es', 'Agregar', 'Agregando…'],
        ['en', 'Add', 'Adding…'],
        ['pt', 'Adicionar', 'Adicionando…']
    ])('add button in %s: idle %s, busy %s', async (locale, idle, busy) => {
        routeFetch({
            listings: [],
            meta: META_OFF,
            handler: (_url, init) => (init.method === 'POST' ? (NEVER as never) : undefined)
        });
        renderSection({ locale });
        fireEvent.change(await screen.findByRole('textbox', { name: /URL/ }), {
            target: { value: 'https://maps.google.com/?cid=999' }
        });
        expect(screen.getByRole('button', { name: idle })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: idle }));

        const busyButton = await screen.findByRole('button', { name: busy });
        expect(busyButton).toHaveAttribute('aria-busy', 'true');
        expect(idle).not.toBe(busy);
    });

    it.each<[SupportedLocale, string, string]>([
        ['es', 'Actualizar reseñas', 'Actualizando…'],
        ['en', 'Refresh reviews', 'Refreshing…'],
        ['pt', 'Atualizar avaliações', 'Atualizando…']
    ])('refresh button in %s: idle %s, busy %s', async (locale, idle, busy) => {
        routeFetch({
            handler: (url, init) =>
                init.method === 'POST' && url.includes('/refresh') ? (NEVER as never) : undefined
        });
        renderSection({ locale });
        const button = await screen.findByTestId('refresh-button');
        await waitFor(() => expect(button).not.toBeDisabled());
        expect(button).toHaveTextContent(idle);

        fireEvent.click(button);

        await waitFor(() => expect(button).toHaveTextContent(busy));
        expect(button).toHaveAttribute('aria-busy', 'true');
    });
});
