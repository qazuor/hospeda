/**
 * @file FavoritesView.test.tsx
 * @description Behavior of the favorites page island on the account kit
 * (HOS-2480).
 *
 * Covers:
 * - Without the plan: ONE plan LockedState naming the catalog plans (from the
 *   prop, never a literal), no enabled control inside it besides «Ver planes».
 * - «Crear colección» and «Mover» read the same gate: same lock, same sentence.
 * - With the plan: no lock, the collections and their usage line.
 * - Type tabs; «Sin colección» paginates server-side (HOS-2420).
 * - Removing asks first and only deletes on confirm (HOS-2429).
 * - A failed read is ErrorState with a retry that works (HOS-2414 AC-2).
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoritesView } from '../../../../src/components/account/favorites/FavoritesView.client';
import { bookmark, installFavoritesApi, requestedUrls } from './test-api';

vi.mock('../../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

/** Fixture catalog plan: never a name the code could carry. */
const PLAN = 'Plan Fixture Trotamundos';

const originalFetch = globalThis.fetch;

function renderView(props: Partial<React.ComponentProps<typeof FavoritesView>> = {}) {
    return render(
        <FavoritesView
            locale="es"
            apiUrl="http://api.test"
            gatePlanNames={[PLAN]}
            initialUsage={null}
            initialAccessDenied={false}
            {...props}
        />
    );
}

/** The locked region: the LockedState root carries `data-reason`. */
function lockedRegions(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-reason="plan"]'));
}

describe('FavoritesView (HOS-2480)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    describe('without the collections plan', () => {
        it('renders ONE plan LockedState with the catalog plan names', async () => {
            installFavoritesApi({ bookmarks: [bookmark(1)], collections: 'noPlan' });
            renderView({ initialAccessDenied: true });

            await waitFor(() => expect(lockedRegions()).toHaveLength(1));
            const locked = lockedRegions()[0] as HTMLElement;
            expect(within(locked).getByText(PLAN)).toBeInTheDocument();
            expect(within(locked).getByRole('link', { name: 'Ver planes' })).toHaveAttribute(
                'href',
                expect.stringContaining('/es/')
            );
            // Nothing to operate inside the lock besides the way out.
            expect(
                within(locked)
                    .queryAllByRole('button')
                    .filter((b) => !(b as HTMLButtonElement).disabled)
            ).toHaveLength(0);
            expect(within(locked).queryAllByRole('textbox')).toHaveLength(0);
        });

        it('«Crear colección» is disabled AND says why', async () => {
            installFavoritesApi({ collections: 'noPlan' });
            renderView({ initialAccessDenied: true });

            const create = screen.getByTestId('create-collection-button');
            expect(create).toBeDisabled();
            const reasonId = create.getAttribute('aria-describedby');
            expect(reasonId).toBeTruthy();
            expect(document.getElementById(reasonId as string)).toHaveTextContent(
                'Tu plan no incluye colecciones.'
            );
        });

        it('«Mover» agrees with «Crear colección»: no create entry, the same sentence', async () => {
            installFavoritesApi({ bookmarks: [bookmark(1)], collections: 'noPlan' });
            renderView({ initialAccessDenied: true });

            fireEvent.click(await screen.findByTestId('move-bookmark-button-bm-1'));
            const dialog = await screen.findByRole('dialog');
            expect(
                within(dialog).queryByRole('button', { name: '+ Crear nueva colección' })
            ).not.toBeInTheDocument();
            const headerReason = document.getElementById(
                screen.getByTestId('create-collection-button').getAttribute('aria-describedby') ??
                    ''
            );
            expect(within(dialog).getByTestId('move-bookmark-create-locked').textContent).toBe(
                headerReason?.textContent
            );
        });
    });

    describe('with the collections plan', () => {
        it('shows no lock, the collections and the usage line; Crear is enabled', async () => {
            installFavoritesApi({
                collections: [{ id: 'col-1', name: 'Verano', bookmarkCount: 2 }],
                usage: { current: 1, max: 10 }
            });
            renderView({ initialUsage: { current: 1, max: 10 } });

            expect(await screen.findByRole('link', { name: 'Verano' })).toHaveAttribute(
                'href',
                '/es/mi-cuenta/favoritos/colecciones/col-1/'
            );
            expect(screen.getByText('1 de 10 colecciones usadas')).toBeInTheDocument();
            expect(lockedRegions()).toHaveLength(0);
            expect(screen.getByTestId('create-collection-button')).toBeEnabled();
        });

        it('at the limit, Crear and Mover show the same limit sentence', async () => {
            installFavoritesApi({
                bookmarks: [bookmark(1)],
                collections: [{ id: 'col-1', name: 'Verano', bookmarkCount: 2 }],
                usage: { current: 1, max: 1 }
            });
            renderView({ initialUsage: { current: 1, max: 1 } });

            const create = screen.getByTestId('create-collection-button');
            expect(create).toBeDisabled();
            fireEvent.click(await screen.findByTestId('move-bookmark-button-bm-1'));
            const dialog = await screen.findByRole('dialog');
            expect(within(dialog).getByTestId('move-bookmark-create-locked')).toHaveTextContent(
                'Ya alcanzaste el máximo de 1 colecciones'
            );
            expect(
                document.getElementById(create.getAttribute('aria-describedby') ?? '')
            ).toHaveTextContent('Ya alcanzaste el máximo de 1 colecciones');
        });
    });

    describe('«Sin colección»', () => {
        it('has one tab per entity type and re-reads by type', async () => {
            const api = installFavoritesApi({
                bookmarks: [bookmark(1), bookmark(2, { entityType: 'EVENT' })]
            });
            renderView();

            const tablist = screen.getByRole('tablist', { name: 'Filtrar por tipo' });
            const names = within(tablist)
                .getAllByRole('tab')
                .map((tab) => tab.textContent ?? '');
            expect(names.some((n) => n.startsWith('Todos'))).toBe(true);
            expect(names.some((n) => n.startsWith('Alojamientos'))).toBe(true);
            expect(names.some((n) => n.startsWith('Eventos'))).toBe(true);

            fireEvent.click(within(tablist).getByRole('tab', { name: /^Eventos/ }));
            await waitFor(() =>
                expect(
                    requestedUrls(api).some(
                        (u) => u.includes('uncollected=true') && u.includes('entityType=EVENT')
                    )
                ).toBe(true)
            );
        });

        it('paginates on the server: page 2 is requested, never sliced locally (HOS-2420)', async () => {
            const api = installFavoritesApi({
                bookmarks: Array.from({ length: 20 }, (_, i) => bookmark(i + 1))
            });
            renderView();

            expect(await screen.findByText('Lugar 1')).toBeInTheDocument();
            expect(screen.queryByText('Lugar 13')).not.toBeInTheDocument();
            const firstRead = requestedUrls(api).find((u) => u.includes('uncollected=true'));
            expect(firstRead).toContain('pageSize=12');

            const nav = screen.getByRole('navigation', { name: /pagin/i });
            fireEvent.click(within(nav).getByRole('button', { name: /2/ }));

            expect(await screen.findByText('Lugar 13')).toBeInTheDocument();
            expect(
                requestedUrls(api).some(
                    (u) => u.includes('uncollected=true') && u.includes('page=2')
                )
            ).toBe(true);
        });

        it('removing asks first; cancel keeps it, confirm deletes (HOS-2429)', async () => {
            const api = installFavoritesApi({ bookmarks: [bookmark(1), bookmark(2)] });
            renderView();

            fireEvent.click(
                await screen.findByRole('button', { name: 'Quitar de favoritos: Lugar 1' })
            );
            let dialog = await screen.findByRole('alertdialog');
            fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
            await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
            expect(api.mock.calls.some((c) => c[1]?.method === 'DELETE')).toBe(false);
            expect(screen.getByText('Lugar 1')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Quitar de favoritos: Lugar 1' }));
            dialog = await screen.findByRole('alertdialog');
            fireEvent.click(within(dialog).getByRole('button', { name: 'Quitar' }));

            await waitFor(() =>
                expect(
                    api.mock.calls.some(
                        (c) => c[1]?.method === 'DELETE' && String(c[0]).endsWith('/bm-1')
                    )
                ).toBe(true)
            );
            await waitFor(() => expect(screen.queryByText('Lugar 1')).not.toBeInTheDocument());
            expect(screen.getByText('Lugar 2')).toBeInTheDocument();
        });

        it('a note on a favorite warns that removing drops it (HOS-2429)', async () => {
            installFavoritesApi({ bookmarks: [bookmark(1, { description: 'Ir en marzo' })] });
            renderView();

            fireEvent.click(
                await screen.findByRole('button', { name: 'Quitar de favoritos: Lugar 1' })
            );
            expect(await screen.findByRole('alertdialog')).toHaveTextContent(
                'También se elimina la nota'
            );
        });

        it('a failed read is ErrorState with a retry that works (AC-2)', async () => {
            installFavoritesApi({ bookmarks: [bookmark(1)], failListReads: 1 });
            renderView();

            expect(await screen.findByText('Error al cargar los favoritos')).toBeInTheDocument();
            expect(screen.queryByText('No tenés favoritos')).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));

            expect(await screen.findByText('Lugar 1')).toBeInTheDocument();
        });
    });
});
