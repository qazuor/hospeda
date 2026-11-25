/**
 * @file ConversationInbox.test.tsx
 * @description Behaviour of the shared inbox island (HOS-2481 guest, HOS-2482
 * owner): loading, empty, error with retry (a failed read is NEVER the empty
 * inbox nor «0», HOS-2422), rows and every page linked.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { guestList, ownerList } = vi.hoisted(() => ({
    guestList: vi.fn(),
    ownerList: vi.fn()
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    protectedConversationsApi: { list: guestList },
    ownerConversationsApi: { list: ownerList }
}));

import {
    ConversationInbox,
    INBOX_PAGE_SIZE
} from '../../../../src/components/account/conversations/ConversationInbox.client';

const failure = { ok: false, error: { status: 500, message: 'boom' } } as const;
const page = (items: readonly unknown[], totalPages = 1) => ({
    ok: true,
    data: {
        items,
        pagination: { page: 1, pageSize: INBOX_PAGE_SIZE, total: items.length, totalPages }
    }
});

const guestItem = {
    id: 'c1',
    accommodationId: 'a1',
    accommodationName: 'Cabañas del Río',
    lastMessageExcerpt: 'Hola, ¿hay lugar?',
    unreadCount: 2,
    lastActivityAt: '2026-11-20T14:00:00Z',
    status: 'OPEN',
    archivedByGuest: false
};

const ownerItem = {
    id: 'c9',
    accommodationId: 'a1',
    accommodationName: 'Cabañas del Río',
    guestName: 'Ana Pérez',
    guestId: 'u1',
    lastMessageExcerpt: 'Consulta',
    unreadCount: 0,
    lastActivityAt: '2026-11-19T10:00:00Z',
    status: 'OPEN'
};

beforeEach(() => {
    guestList.mockReset();
    ownerList.mockReset();
});

describe.each([
    ['guest', guestList],
    ['owner', ownerList]
] as const)('ConversationInbox viewer=%s', (viewer, list) => {
    it('shows the loading skeleton first', () => {
        list.mockReturnValue(new Promise(() => undefined));
        const { container } = render(
            <ConversationInbox
                locale="es"
                viewer={viewer}
                page={1}
            />
        );
        expect(container.querySelector('[aria-busy="true"], [role="status"]')).not.toBeNull();
    });

    it('a forced fetch failure renders ErrorState with retry, never the empty inbox or 0', async () => {
        // Arrange
        list.mockResolvedValueOnce(failure).mockResolvedValueOnce(page([]));
        const user = userEvent.setup();
        render(
            <ConversationInbox
                locale="es"
                viewer={viewer}
                page={1}
            />
        );

        // Assert: error, not empty
        expect(await screen.findByText('No pudimos cargar tus consultas')).toBeInTheDocument();
        expect(screen.queryByText(/Todavía no tenés/)).not.toBeInTheDocument();
        expect(screen.queryByText('0')).not.toBeInTheDocument();

        // Act: retry reads again
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));

        // Assert: the second, successful read is the real empty inbox
        expect(await screen.findByText(/Todavía no tenés/)).toBeInTheDocument();
        expect(list).toHaveBeenCalledTimes(2);
    });

    it('a successful empty read renders the empty state', async () => {
        list.mockResolvedValue(page([]));
        render(
            <ConversationInbox
                locale="es"
                viewer={viewer}
                page={1}
            />
        );
        expect(await screen.findByText(/Todavía no tenés/)).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('asks the API for the current page and links every page (no silent cap)', async () => {
        list.mockResolvedValue(page([viewer === 'guest' ? guestItem : ownerItem], 3));
        render(
            <ConversationInbox
                locale="es"
                viewer={viewer}
                page={2}
            />
        );
        await screen.findByRole('link', { name: 'Página 3' });
        expect(list).toHaveBeenCalledWith({ page: 2, pageSize: INBOX_PAGE_SIZE });
        const base =
            viewer === 'guest'
                ? '/es/mi-cuenta/consultas/'
                : '/es/mi-cuenta/consultas-propietario/';
        for (const target of [1, 3]) {
            expect(screen.getByRole('link', { name: `Página ${target}` })).toHaveAttribute(
                'href',
                `${base}?page=${target}`
            );
        }
    });
});

describe('ConversationInbox rows', () => {
    it('keeps API order, decorative avatars and unread markers in one responsive list', async () => {
        guestList.mockResolvedValue(
            page([
                guestItem,
                {
                    ...guestItem,
                    id: 'c2',
                    accommodationName: 'Another stay',
                    unreadCount: 0,
                    lastMessageExcerpt: null
                }
            ])
        );
        const { container } = render(
            <ConversationInbox
                locale="es"
                viewer="guest"
                page={1}
            />
        );
        await screen.findByRole('link', { name: 'Another stay' });
        const rows = Array.from(container.querySelectorAll('[data-row]'));
        expect(rows.map((row) => row.getAttribute('data-row'))).toEqual(['c1', 'c2']);
        expect(rows[0]).toHaveAttribute('data-emphasis');
        expect(rows[1]).not.toHaveAttribute('data-emphasis');
        for (const row of rows)
            expect(row.querySelector('[data-palette][aria-hidden="true"]')).not.toBeNull();
        expect(screen.getByRole('img', { name: '2 sin leer' })).toBeInTheDocument();
        expect(rows[1]?.textContent).toContain('Sin mensajes todavía');
    });
    it('guest rows: listing as title, link to the guest thread, unread CountPill', async () => {
        guestList.mockResolvedValue(page([guestItem]));
        render(
            <ConversationInbox
                locale="es"
                viewer="guest"
                page={1}
            />
        );
        const list = await screen.findByRole('list', { name: 'Tus consultas' });
        expect(list).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Cabañas del Río' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/consultas/c1/'
        );
        expect(screen.getByText('Hola, ¿hay lugar?')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: '2 sin leer' })).toHaveTextContent('2');
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });

    it('owner rows: guest as title, listing as meta, link to the owner thread', async () => {
        ownerList.mockResolvedValue(page([ownerItem]));
        render(
            <ConversationInbox
                locale="es"
                viewer="owner"
                page={1}
            />
        );
        await screen.findByRole('list', { name: 'Conversaciones con huéspedes' });
        expect(screen.getByRole('link', { name: 'Ana Pérez' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/consultas-propietario/c9/'
        );
        expect(screen.getByText('Cabañas del Río')).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByRole('img')).not.toBeInTheDocument());
    });
});

/**
 * HOS-2600 regression: a conversation whose guest has not verified their email
 * yet (`PENDING_VERIFICATION`, HOS-2568) has no message, and the API sends its
 * `lastActivityAt` as `null` (the column is nullable). `new Date(null)` is the
 * epoch, which printed «31 de dic de 1969» in Buenos Aires.
 */
describe('ConversationInbox — conversation without activity (HOS-2600)', () => {
    it.each([
        ['guest', guestList, guestItem],
        ['owner', ownerList, ownerItem]
    ] as const)('viewer=%s: a null lastActivityAt never prints 1969 and says there are no messages yet', async (viewer, list, item) => {
        // Arrange
        list.mockResolvedValue(page([{ ...item, lastActivityAt: null, lastMessageExcerpt: null }]));

        // Act
        const { container } = render(
            <ConversationInbox
                locale="es"
                viewer={viewer}
                page={1}
            />
        );
        await screen.findByRole('list');

        // Assert
        expect(container.textContent).not.toMatch(/1969|1970/);
        expect(container.querySelector('time')).toBeNull();
        expect(screen.getByText('Sin mensajes todavía')).toBeInTheDocument();
    });

    it('a real date still renders as a <time> with its instant', async () => {
        // Arrange
        ownerList.mockResolvedValue(page([ownerItem]));

        // Act
        const { container } = render(
            <ConversationInbox
                locale="es"
                viewer="owner"
                page={1}
            />
        );
        await screen.findByRole('list');

        // Assert
        const time = container.querySelector('time');
        expect(time).toHaveAttribute('dateTime', '2026-11-19T10:00:00Z');
        expect(time?.textContent).toMatch(/2026/);
        expect(screen.queryByText('Sin mensajes todavía')).not.toBeInTheDocument();
    });
});
