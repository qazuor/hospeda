/**
 * @file ExternalReputationSection.test.tsx
 * @description Rendering and loading behaviour of the external reputation
 * section (SPEC-237 T-013, rebuilt on the Mi Cuenta kit by HOS-2515): the kit
 * surface, the metadata of HOS-290, the connected sources and the layout
 * contract (URLs wrapped whole, no second chip).
 *
 * The persisting actions live in `external-reputation/actions.test.tsx` and the
 * add form in `external-reputation/add-listing.test.tsx`.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetEditorAutoSave } from '@/components/account/editor-shell/editor-auto-save-signal';
import { getApiUrl } from '@/lib/env';
import {
    callsTo,
    LISTING_BOOKING,
    LISTING_GOOGLE,
    listingsResponse,
    META_OFF,
    META_ON,
    renderSection,
    reply,
    routeFetch
} from './external-reputation/fixtures';

const MASTER = 'Mostrar sección de reputación externa';
const EXPLAINER = /El texto de las reseñas solo está disponible para Google/i;

beforeEach(() => {
    __resetEditorAutoSave();
    vi.stubGlobal('fetch', vi.fn());
});

describe('ExternalReputationSection', () => {
    describe('kit surface', () => {
        it('renders ONE flat kit Section carrying the page help anchor', async () => {
            routeFetch();
            const { container } = renderSection();
            await screen.findByRole('switch', { name: MASTER });

            const sections = container.querySelectorAll('[data-kit-section]');
            expect(sections).toHaveLength(1);
            expect(sections[0]?.getAttribute('data-help')).toBe('section:accommodation.reputacion');
        });

        it('renders the Google-only explainer before the data loads', () => {
            vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));
            renderSection();
            expect(screen.getByText(EXPLAINER)).toBeInTheDocument();
        });

        it('keeps the explainer after the data loads', async () => {
            routeFetch();
            renderSection();
            await screen.findByRole('switch', { name: MASTER });
            expect(screen.getByText(EXPLAINER)).toBeInTheDocument();
        });

        it('renders no auto-save chip of its own (the shell owns it)', async () => {
            routeFetch();
            renderSection();
            await screen.findByRole('switch', { name: MASTER });
            expect(screen.queryByText(/Guardado|Guardando|No se guardó/)).not.toBeInTheDocument();
        });
    });

    describe('loading and empty states', () => {
        it('shows a spinner while loading and none after', async () => {
            routeFetch({ listings: [] });
            renderSection();
            expect(screen.getByRole('status')).toBeInTheDocument();
            await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
        });

        it('shows the empty state and no rows when there are no listings', async () => {
            routeFetch({ listings: [], meta: META_OFF });
            renderSection();
            expect(await screen.findByTestId('ext-rep-empty')).toBeInTheDocument();
            expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
        });

        it('calls GET /external-listings exactly once on mount (stable effect)', async () => {
            routeFetch({ listings: [] });
            renderSection();
            await screen.findByTestId('ext-rep-empty');
            await new Promise((resolve) => setTimeout(resolve, 50));

            const gets = vi
                .mocked(global.fetch)
                .mock.calls.filter(
                    ([url, init]) =>
                        String(url).endsWith('/external-listings') &&
                        !(init as RequestInit | undefined)?.method
                );
            expect(gets).toHaveLength(1);
        });

        it('shows the load error when the server sends the OLD bare-array shape (HOS-290)', async () => {
            vi.mocked(global.fetch).mockResolvedValue(reply(200, { data: [LISTING_GOOGLE] }));
            renderSection();
            expect(
                await screen.findByText(/No se pudieron cargar las reseñas externas/)
            ).toBeInTheDocument();
        });
    });

    describe('reputation metadata (HOS-290)', () => {
        it('reflects the master toggle from the response', async () => {
            routeFetch({ meta: META_ON });
            renderSection();
            await waitFor(() =>
                expect(screen.getByRole('switch', { name: MASTER })).toHaveAttribute(
                    'aria-checked',
                    'true'
                )
            );
        });

        it('leaves the master toggle off when the response says so', async () => {
            routeFetch({ meta: META_OFF });
            renderSection();
            const toggle = await screen.findByRole('switch', { name: MASTER });
            await waitFor(() => expect(toggle).not.toBeDisabled());
            expect(toggle).toHaveAttribute('aria-checked', 'false');
        });

        it('calls the API on an ABSOLUTE url, not a relative path', async () => {
            routeFetch();
            renderSection();
            await screen.findByRole('switch', { name: MASTER });
            expect(String(vi.mocked(global.fetch).mock.calls[0]?.[0]).startsWith(getApiUrl())).toBe(
                true
            );
        });

        it('renders the last-updated line from aggregateFetchedAt', async () => {
            routeFetch();
            renderSection();
            expect(await screen.findByText(/Última actualización/)).toBeInTheDocument();
        });
    });

    describe('auto-enabled notice', () => {
        const NOTICE = /Activamos esta sección automáticamente/;
        const AUTO = {
            ...META_ON,
            autoEnabledAt: '2026-06-01T12:00:00.000Z',
            toggleDecidedAt: '2026-06-01T12:00:00.000Z'
        };

        it('shows it when the automation enabled the section and nobody decided since', async () => {
            routeFetch({ meta: AUTO });
            renderSection();
            expect(await screen.findByText(NOTICE)).toBeInTheDocument();
        });

        it('hides it when the owner decided after the automatic enable', async () => {
            routeFetch({ meta: { ...AUTO, toggleDecidedAt: '2026-06-02T09:00:00.000Z' } });
            renderSection();
            await waitFor(() =>
                expect(screen.getByRole('switch', { name: MASTER })).toHaveAttribute(
                    'aria-checked',
                    'true'
                )
            );
            expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
        });

        it('hides it when the toggle is off', async () => {
            routeFetch({ meta: { ...AUTO, showExternalReputation: false } });
            renderSection();
            await screen.findByRole('switch', { name: MASTER });
            expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
        });

        it('hides it after the owner flips the toggle', async () => {
            routeFetch({ meta: AUTO });
            renderSection();
            await screen.findByText(NOTICE);
            const toggle = screen.getByRole('switch', { name: MASTER });
            await waitFor(() => expect(toggle).not.toBeDisabled());
            fireEvent.click(toggle);
            await waitFor(() => expect(screen.queryByText(NOTICE)).not.toBeInTheDocument());
        });
    });

    describe('connected sources', () => {
        it('renders one row per listing inside a named list', async () => {
            routeFetch({ listings: [LISTING_GOOGLE, LISTING_BOOKING] });
            renderSection();
            const list = await screen.findByRole('list', { name: 'Plataformas conectadas' });
            expect(list.querySelectorAll(':scope > li')).toHaveLength(2);
        });

        it('renders the platform name, two visibility switches and a remove button per row', async () => {
            routeFetch({ listings: [LISTING_GOOGLE] });
            renderSection();
            const group = await screen.findByRole('group', { name: 'Google' });
            expect(group.querySelectorAll('[role="switch"]')).toHaveLength(2);
            expect(screen.getByRole('button', { name: 'Eliminar Google' })).toBeInTheDocument();
        });

        it('reflects each flag in its switch', async () => {
            routeFetch({ listings: [LISTING_GOOGLE] });
            renderSection();
            const link = await screen.findByRole('switch', {
                name: 'Mostrar enlace a la plataforma'
            });
            const reviews = screen.getByRole('switch', { name: 'Mostrar reseñas de texto' });
            expect(link).toHaveAttribute('aria-checked', 'true');
            expect(reviews).toHaveAttribute('aria-checked', 'false');
        });

        it('renders a LONG url whole and wrappable, never truncated', async () => {
            const longUrl = `https://www.google.com/maps/place/${'Hostería+Los+Árboles+del+Río+'.repeat(8)}/@-32.4825,-58.2372,17z`;
            routeFetch({ listings: [{ ...LISTING_GOOGLE, url: longUrl }] });
            renderSection();

            const node = await screen.findByText(longUrl);
            expect(node.textContent).toBe(longUrl);
            expect(node.textContent).not.toContain('...');
            expect(callsTo({ part: '/external-listings', method: 'POST' })).toHaveLength(0);
        });
    });

    describe('listing contract', () => {
        it('parses the payload through the shared schema (a fixture must match it)', () => {
            expect(() => listingsResponse([LISTING_GOOGLE, LISTING_BOOKING])).not.toThrow();
        });
    });
});
