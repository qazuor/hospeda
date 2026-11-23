/**
 * @file CollectionDetailView.test.tsx
 * @description Behavior of the collection detail island (HOS-2480).
 *
 * Covers:
 * - PageHeader with the back link (replaces Breadcrumbs) and Edit/Delete.
 * - Type tabs as URL links for every collection type, ATTRACTION included
 *   (HOS-2423), the active one marked.
 * - Cards for VENUE/EXPERIENCE/ATTRACTION bookmarks.
 * - A failed SSR read is ErrorState with a retry, never an empty collection.
 * - Removing from the collection asks first (testid kept for e2e).
 * - Link pagination keeps the type filter.
 * - File sizes of the split favorites files stay ≤ 500 lines.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type CollectionDetailRead,
    CollectionDetailView
} from '../../../../src/components/account/favorites/CollectionDetailView.client';
import { bookmark } from './test-api';

vi.mock('../../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

vi.mock('../../../../src/components/account/CreateEditCollectionModal.client', () => ({
    CreateEditCollectionModal: () => null
}));

const READ: CollectionDetailRead = {
    ok: true,
    collection: { id: 'col-1', name: 'Verano', description: 'Para enero', color: null, icon: null },
    bookmarks: [
        bookmark(1, { entityType: 'VENUE' }),
        bookmark(2, { entityType: 'EXPERIENCE' }),
        bookmark(3, { entityType: 'ATTRACTION' })
    ],
    total: 30,
    totalPages: 3
};

const originalFetch = globalThis.fetch;
const originalLocation = window.location;

/** Replaces `window.location` with one whose `reload` is a spy (jsdom cannot reload). */
function stubReload() {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...originalLocation, reload }
    });
    return reload;
}

function renderView(props: Partial<React.ComponentProps<typeof CollectionDetailView>> = {}) {
    return render(
        <CollectionDetailView
            locale="es"
            apiUrl="http://api.test"
            collectionId="col-1"
            read={READ}
            currentPage={1}
            {...props}
        />
    );
}

describe('CollectionDetailView (HOS-2480)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    });

    it('renders the header with the back link and the actions', () => {
        renderView();
        expect(screen.getByRole('heading', { level: 1, name: 'Verano' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Volver a mis favoritos/ })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/favoritos/'
        );
        expect(screen.getByTestId('collection-actions-edit')).toBeInTheDocument();
        expect(screen.getByTestId('collection-actions-delete')).toBeInTheDocument();
    });

    it('has a URL tab per collection type, ATTRACTION included (HOS-2423)', () => {
        renderView({ activeEntityType: 'ATTRACTION' });
        const nav = screen.getByRole('navigation', { name: 'Filtrar por tipo' });
        const attraction = within(nav).getByRole('link', { name: 'Atracciones' });
        expect(attraction).toHaveAttribute('aria-current', 'page');
        expect(attraction.getAttribute('href')).toContain('entityType=ATTRACTION');
        expect(within(nav).getByRole('link', { name: 'Comer y salir' })).toBeInTheDocument();
        expect(within(nav).getByRole('link', { name: 'Experiencias' })).toBeInTheDocument();
        expect(within(nav).getByRole('link', { name: 'Todos' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/favoritos/colecciones/col-1/'
        );
    });

    it('renders a card per bookmark of every type', () => {
        renderView();
        const list = screen.getByRole('list', { name: /favoritos/i });
        expect(within(list).getAllByRole('listitem')).toHaveLength(3);
        expect(screen.getByRole('link', { name: 'Lugar 3' })).toBeInTheDocument();
    });

    it('a failed read is ErrorState with a retry, never an empty collection', () => {
        const reload = stubReload();
        renderView({ read: { ok: false } });

        expect(
            screen.queryByText('Esta colección no tiene favoritos del tipo seleccionado.')
        ).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('an empty collection says so', () => {
        renderView({ read: { ...READ, bookmarks: [], total: 0, totalPages: 0 } });
        expect(
            screen.getByText('Esta colección no tiene favoritos del tipo seleccionado.')
        ).toBeInTheDocument();
    });

    it('removing from the collection asks first and only deletes on confirm', async () => {
        const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
        globalThis.fetch = fetchMock as unknown as typeof fetch;
        const reload = stubReload();
        renderView();

        const [first] = screen.getAllByTestId('collection-bookmark-remove-btn');
        fireEvent.click(first as HTMLElement);
        const dialog = await screen.findByRole('alertdialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(fetchMock).not.toHaveBeenCalled();

        fireEvent.click(first as HTMLElement);
        fireEvent.click(
            within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Quitar' })
        );
        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                'http://api.test/api/v1/protected/user-bookmark-collections/col-1/bookmarks/bm-1',
                expect.objectContaining({ method: 'DELETE' })
            )
        );
        await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    });

    it('link pagination keeps the type filter', () => {
        renderView({ activeEntityType: 'VENUE' });
        const nav = screen.getByRole('navigation', { name: /pagin/i });
        const page2 = within(nav).getByRole('link', { name: /2/ });
        expect(page2.getAttribute('href')).toContain('entityType=VENUE');
        expect(page2.getAttribute('href')).toContain('bookmarksPage=2');
    });
});

describe('favorites split stays small (HOS-2480)', () => {
    const accountDir = resolve(__dirname, '../../../../src/components/account');
    const files = [
        ...readdirSync(resolve(accountDir, 'favorites')).map((f) => `favorites/${f}`),
        'MoveToCollectionModal.client.tsx',
        'CreateEditCollectionModal.client.tsx',
        'CollectionDetailActions.client.tsx',
        'EditableNote.tsx',
        'ui/EntityCard.tsx'
    ];

    it.each(files)('%s has at most 500 lines', (file) => {
        const lines = readFileSync(resolve(accountDir, file), 'utf8').split('\n').length;
        expect(lines).toBeLessThanOrEqual(500);
    });

    it('the 938-line UserFavoritesList is gone', () => {
        expect(() => readFileSync(resolve(accountDir, 'UserFavoritesList.client.tsx'))).toThrow();
    });
});
