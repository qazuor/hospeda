/**
 * Tests for the events/posts own-content list view (HOS-2505, HOS-2440).
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    type OwnContentListItem,
    OwnContentListView
} from '../../../../src/components/account/my-content/OwnContentListView';
import { resolveAccountPageState } from '../../../../src/lib/account-pagination';

const item = (n: number): OwnContentListItem => ({
    id: `id-${n}`,
    title: `Publicación ${n}`,
    moderationState: 'APPROVED',
    visibility: 'PUBLIC',
    lifecycleState: 'ACTIVE'
});

describe('OwnContentListView', () => {
    it.each([
        'posts',
        'events'
    ] as const)('omits create affordances for update-only %s, including empty state', (kind) => {
        for (const status of ['ready', 'empty'] as const) {
            const { container, unmount } = render(
                <OwnContentListView
                    locale="en"
                    kind={kind}
                    status={status}
                    items={status === 'ready' ? [item(1)] : []}
                    page={1}
                    pageCount={1}
                    canCreate={false}
                    canEdit={true}
                />
            );
            expect(container.querySelector('a[href$="/nuevo/"]')).toBeNull();
            if (status === 'ready')
                expect(container.querySelector('a[href$="/editar/"]')).not.toBeNull();
            unmount();
        }
    });
    it.each(['posts', 'events'] as const)('omits edit links for create-only %s', (kind) => {
        const { container } = render(
            <OwnContentListView
                locale="en"
                kind={kind}
                status="ready"
                items={[item(1)]}
                page={1}
                pageCount={1}
                canCreate={true}
                canEdit={false}
            />
        );
        expect(container.querySelector('a[href$="/nuevo/"]')).not.toBeNull();
        expect(container.querySelector('a[href$="/editar/"]')).toBeNull();
    });
    it('HOS-2440: more than 50 posts paginate, every page is linked', () => {
        // Arrange: the API reports 60 posts; the page shows the first 20.
        const pageState = resolveAccountPageState({ requestedPage: 1, total: 60 });
        const items = Array.from({ length: 20 }, (_, i) => item(i + 1));

        // Act
        render(
            <OwnContentListView
                locale="es"
                kind="posts"
                canCreate={true}
                canEdit={true}
                status="ready"
                items={items}
                page={pageState.page}
                pageCount={pageState.totalPages}
            />
        );

        // Assert
        const list = screen.getByRole('list', { name: 'Mis publicaciones' });
        expect(within(list).getAllByRole('listitem')).toHaveLength(20);
        const nav = screen.getByRole('navigation', { name: 'Paginación' });
        expect(within(nav).getByRole('link', { name: 'Página 3' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/publicaciones/?page=3'
        );
    });

    it('HOS-2505: a user without permission sees a LockedState, never the list or the create action', () => {
        render(
            <OwnContentListView
                locale="es"
                kind="posts"
                canCreate={false}
                canEdit={false}
                status="locked"
                items={[]}
                page={1}
                pageCount={1}
            />
        );
        const locked = document.querySelector('[data-reason="permission"]');
        expect(locked).not.toBeNull();
        expect(screen.getByRole('link', { name: 'Saber más' }).getAttribute('href')).toContain(
            'colaborar/editores'
        );
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Agregar publicación' })).not.toBeInTheDocument();
    });

    it('renders the three status axes as words and an edit link per card', () => {
        render(
            <OwnContentListView
                locale="es"
                kind="events"
                canCreate={true}
                canEdit={true}
                status="ready"
                items={[
                    {
                        ...item(1),
                        moderationState: 'PENDING',
                        visibility: 'PRIVATE',
                        lifecycleState: 'DRAFT'
                    }
                ]}
                page={1}
                pageCount={1}
            />
        );
        const card = screen.getByRole('listitem');
        expect(within(card).getByText('Pendiente de revisión')).toBeInTheDocument();
        expect(within(card).getByText('Privada')).toBeInTheDocument();
        expect(within(card).getByText('Borrador')).toBeInTheDocument();
        expect(within(card).getByRole('link', { name: 'Editar «Publicación 1»' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/eventos/id-1/editar/'
        );
        expect(screen.getByRole('link', { name: 'Agregar evento' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/eventos/nuevo/'
        );
    });

    it('shows the empty state with a create link only after a successful empty read', () => {
        render(
            <OwnContentListView
                locale="es"
                kind="events"
                canCreate={true}
                canEdit={true}
                status="empty"
                items={[]}
                page={1}
                pageCount={1}
            />
        );
        expect(screen.getByText('Todavía no creaste ningún evento')).toBeInTheDocument();
        // HOS-2611: one solid primary per screen. The empty state owns the
        // «create» action, so the header does not repeat it.
        expect(screen.getAllByRole('link', { name: 'Agregar evento' })).toHaveLength(1);
    });
});
