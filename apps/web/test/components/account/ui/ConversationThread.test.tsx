/**
 * Tests for the kit ConversationThread and MessageBubble (HOS-2481 / HOS-2482).
 *
 * The core promise (spec G-4, AC-4): ONE component for both inboxes, and the
 * same conversation rendered from each side is a mirror — the viewer's own
 * messages on the right in both (HOS-2419).
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    ConversationThread,
    formatMessageTime,
    type ThreadMessage
} from '../../../../src/components/account/ui';

const CONVERSATION: readonly ThreadMessage[] = [
    {
        id: 'g1',
        senderType: 'guest',
        body: 'Pregunta del huésped',
        createdAt: '2026-11-20T14:00:00Z'
    },
    {
        id: 'o1',
        senderType: 'OWNER',
        body: 'Respuesta del dueño',
        createdAt: '2026-11-20T15:00:00Z'
    },
    { id: 's1', senderType: 'system', body: 'Aviso del sistema', createdAt: '2026-11-20T15:01:00Z' }
];

/** Side of the bubble holding `text`. */
function sideOf(text: string): string | null {
    return screen.getByText(text).closest('li')?.getAttribute('data-side') ?? null;
}

describe('ConversationThread — mirrored alignment', () => {
    it('the same conversation aligns own messages right for the guest AND the owner', () => {
        // Arrange / Act: guest view
        const { unmount } = render(
            <ConversationThread
                viewer="guest"
                messages={CONVERSATION}
                locale="es"
            />
        );

        // Assert
        expect(sideOf('Pregunta del huésped')).toBe('mine');
        expect(sideOf('Respuesta del dueño')).toBe('theirs');
        expect(sideOf('Aviso del sistema')).toBe('system');
        unmount();

        // Act: owner view of the very same messages
        render(
            <ConversationThread
                viewer="owner"
                messages={CONVERSATION}
                locale="es"
            />
        );

        // Assert: mirrored
        expect(sideOf('Pregunta del huésped')).toBe('theirs');
        expect(sideOf('Respuesta del dueño')).toBe('mine');
        expect(sideOf('Aviso del sistema')).toBe('system');
    });

    it('speaks the sender of every message, relative to the viewer', () => {
        render(
            <ConversationThread
                viewer="owner"
                messages={CONVERSATION}
                locale="es"
            />
        );
        const list = screen.getByRole('list', { name: 'Mensajes de la conversación' });
        const items = within(list).getAllByRole('listitem');
        expect(items[0]).toHaveTextContent('Huésped: Pregunta del huésped');
        expect(items[1]).toHaveTextContent('Vos: Respuesta del dueño');
        expect(items[2]).toHaveTextContent('Mensaje del sistema: Aviso del sistema');
    });

    it('renders each time as a <time> with the ISO instant', () => {
        render(
            <ConversationThread
                viewer="guest"
                messages={CONVERSATION.slice(0, 1)}
                locale="es"
            />
        );
        const time = screen.getByText(
            formatMessageTime({ iso: '2026-11-20T14:00:00Z', locale: 'es' })
        );
        expect(time.tagName).toBe('TIME');
        expect(time).toHaveAttribute('dateTime', '2026-11-20T14:00:00Z');
    });

    it('renders the before and after slots around the list', () => {
        render(
            <ConversationThread
                viewer="guest"
                messages={CONVERSATION}
                locale="es"
                before={<a href="?cursor=x">Anteriores</a>}
                after={<p>Leído</p>}
            />
        );
        expect(screen.getByRole('link', { name: 'Anteriores' })).toBeInTheDocument();
        expect(screen.getByText('Leído')).toBeInTheDocument();
    });
});

describe('MessageBubble delivery states', () => {
    it('shows «sending» on an optimistic message', () => {
        render(
            <ConversationThread
                viewer="guest"
                messages={[{ ...CONVERSATION[0]!, delivery: 'sending' }]}
                locale="es"
            />
        );
        expect(screen.getByText('Enviando…')).toBeInTheDocument();
    });

    it('a failed message shows an alert with a retry for that message', async () => {
        // Arrange
        const user = userEvent.setup();
        const onRetry = vi.fn();
        render(
            <ConversationThread
                viewer="guest"
                messages={[{ ...CONVERSATION[0]!, id: 'tmp-1', delivery: 'failed' }]}
                locale="es"
                onRetry={onRetry}
            />
        );

        // Act
        expect(screen.getByRole('alert')).toHaveTextContent('No se pudo enviar');
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));

        // Assert
        expect(onRetry).toHaveBeenCalledWith({ id: 'tmp-1' });
    });
});

describe('formatMessageTime', () => {
    it('falls back to the raw value when it is not a date', () => {
        expect(formatMessageTime({ iso: 'nope', locale: 'es' })).toBe('nope');
    });

    it('formats in the product time zone, whatever the runtime zone', () => {
        // 02:30Z is still the previous day (23:30) in Buenos Aires.
        expect(formatMessageTime({ iso: '2026-11-21T02:30:00Z', locale: 'es' })).toMatch(/20/);
    });
});
