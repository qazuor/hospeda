/**
 * Tests for the kit MyContentList template and ContentCard (HOS-2505).
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    ContentCard,
    LinkButton,
    MyContentList,
    StatusPill
} from '../../../../src/components/account/ui';

describe('ContentCard (kit)', () => {
    it('renders the title, the labelled statuses and the actions', () => {
        // Arrange & Act
        render(
            <ul>
                <ContentCard
                    locale="es"
                    title="Fiesta del río"
                    meta="12 de enero"
                    statuses={[
                        {
                            key: 'moderation',
                            label: 'Moderación',
                            value: <StatusPill tone="warning">Pendiente</StatusPill>
                        }
                    ]}
                    actions={<LinkButton href="/es/mi-cuenta/eventos/1/editar/">Editar</LinkButton>}
                />
            </ul>
        );

        // Assert
        const item = screen.getByRole('listitem');
        expect(
            within(item).getByRole('heading', { level: 3, name: 'Fiesta del río' })
        ).toBeVisible();
        expect(within(item).getByText('12 de enero')).toBeInTheDocument();
        const statuses = within(item).getByLabelText('Estados');
        expect(within(statuses).getByText('Moderación')).toBeInTheDocument();
        expect(within(statuses).getByText('Pendiente')).toBeInTheDocument();
        expect(within(item).getByRole('link', { name: 'Editar' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/eventos/1/editar/'
        );
    });

    it('links the title when href is given', () => {
        render(
            <ul>
                <ContentCard
                    locale="en"
                    title="River party"
                    href="/en/x/"
                />
            </ul>
        );
        expect(screen.getByRole('link', { name: 'River party' })).toHaveAttribute('href', '/en/x/');
        expect(screen.queryByLabelText('Statuses')).not.toBeInTheDocument();
    });
});

const base = {
    locale: 'es' as const,
    title: 'Mis eventos',
    sectionTitle: 'Tus eventos',
    helpId: 'section:content.events' as const,
    listLabel: 'Mis eventos'
};

describe('MyContentList (kit)', () => {
    it('renders one h1 with the create action and the cards in a labelled list', () => {
        render(
            <MyContentList
                {...base}
                state={{ status: 'ready' }}
                createAction={<LinkButton href="/es/nuevo/">Nuevo evento</LinkButton>}
            >
                <ContentCard
                    locale="es"
                    title="Uno"
                />
                <ContentCard
                    locale="es"
                    title="Dos"
                />
            </MyContentList>
        );
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('link', { name: 'Nuevo evento' })).toBeInTheDocument();
        const list = screen.getByRole('list', { name: 'Mis eventos' });
        expect(within(list).getAllByRole('listitem')).toHaveLength(2);
        // One page: no paginator.
        expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
    });

    it('HOS-2440: renders every page link when there is more than one page (no silent cap)', () => {
        // 60 items at 20 per page = 3 pages.
        render(
            <MyContentList
                {...base}
                state={{ status: 'ready' }}
                pagination={{
                    page: 1,
                    pageCount: 3,
                    hrefFor: (p) => `/es/mi-cuenta/eventos/?page=${p}`
                }}
            >
                <ContentCard
                    locale="es"
                    title="Uno"
                />
            </MyContentList>
        );
        const nav = screen.getByRole('navigation', { name: 'Paginación' });
        expect(within(nav).getByRole('link', { name: 'Página 3' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/eventos/?page=3'
        );
    });

    it('drives client pagination through onPageChange', () => {
        const onPageChange = vi.fn();
        render(
            <MyContentList
                {...base}
                state={{ status: 'ready' }}
                pagination={{ page: 1, pageCount: 2, onPageChange }}
            >
                <ContentCard
                    locale="es"
                    title="Uno"
                />
            </MyContentList>
        );
        screen.getByRole('button', { name: 'Página 2' }).click();
        expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('renders the LockedState and no list when locked', () => {
        render(
            <MyContentList
                {...base}
                state={{
                    status: 'locked',
                    reason: {
                        kind: 'permission',
                        feature: 'Eventos',
                        description: 'Solo editores.',
                        helpHref: '/es/colaborar/editores/'
                    }
                }}
            />
        );
        expect(screen.getByRole('heading', { level: 3, name: 'Eventos' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Saber más' })).toHaveAttribute(
            'href',
            '/es/colaborar/editores/'
        );
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('renders an error with retry, never the empty state, when the read failed', () => {
        const retry = vi.fn();
        render(
            <MyContentList
                {...base}
                state={{ status: 'error', retry }}
                empty={<p>vacío</p>}
            />
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.queryByText('vacío')).not.toBeInTheDocument();
        screen.getByRole('button', { name: 'Reintentar' }).click();
        expect(retry).toHaveBeenCalled();
    });

    it('uses the caller errorRegion when given', () => {
        render(
            <MyContentList
                {...base}
                state={{ status: 'error' }}
                errorRegion={<p>isla de reintento</p>}
            />
        );
        expect(screen.getByText('isla de reintento')).toBeInTheDocument();
    });

    it('renders the empty piece and the loading skeleton', () => {
        const { rerender } = render(
            <MyContentList
                {...base}
                state={{ status: 'empty' }}
                empty={<p>vacío</p>}
            />
        );
        expect(screen.getByText('vacío')).toBeInTheDocument();
        rerender(
            <MyContentList
                {...base}
                state={{ status: 'loading' }}
            />
        );
        expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    });
});
