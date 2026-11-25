/**
 * @file ConversationPanel.test.tsx
 * @description Behaviour of the shared thread island (HOS-2481 guest, HOS-2482
 * owner): the same conversation is a mirror from each side (HOS-2419), sending
 * appends the message optimistically WITHOUT navigating or reloading
 * (HOS-2439), and a failed send keeps the message with a retry.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMessage, ownerReply, getThread } = vi.hoisted(() => ({
    sendMessage: vi.fn(),
    getThread: vi.fn(),
    ownerReply: vi.fn()
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    protectedConversationsApi: { sendMessage, getThread },
    ownerConversationsApi: { reply: ownerReply }
}));

import {
    ConversationPanel,
    sendErrorMessage
} from '../../../../src/components/account/conversations/ConversationPanel.client';
import type { ConversationMessageItem } from '../../../../src/lib/api/endpoints-protected';

const MESSAGES: readonly ConversationMessageItem[] = [
    {
        id: 'm1',
        senderType: 'guest',
        body: 'Pregunta del huésped',
        createdAt: '2026-11-20T14:00:00Z'
    },
    {
        id: 'm2',
        senderType: 'owner',
        body: 'Respuesta del dueño',
        createdAt: '2026-11-20T15:00:00Z'
    }
];

/** Side of the bubble holding `text`. */
const sideOf = (text: string) =>
    screen.getByText(text).closest('li')?.getAttribute('data-side') ?? null;

const startHref = window.location.href;
const reload = vi.fn();

beforeEach(() => {
    sendMessage.mockReset();
    getThread.mockReset();
    getThread.mockResolvedValue({ ok: true, data: { messages: [] } });
    ownerReply.mockReset();
    reload.mockReset();
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, href: startHref, reload }
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('ConversationPanel — one thread, two viewers', () => {
    it('renders the same conversation mirrored: own messages right for guest AND owner', () => {
        const { unmount } = render(
            <ConversationPanel
                locale="es"
                viewer="guest"
                conversationId="c1"
                initialMessages={MESSAGES}
                canReply={false}
            />
        );
        expect(sideOf('Pregunta del huésped')).toBe('mine');
        expect(sideOf('Respuesta del dueño')).toBe('theirs');
        unmount();

        render(
            <ConversationPanel
                locale="es"
                viewer="owner"
                conversationId="c1"
                initialMessages={MESSAGES}
                canReply={false}
            />
        );
        expect(sideOf('Pregunta del huésped')).toBe('theirs');
        expect(sideOf('Respuesta del dueño')).toBe('mine');
    });

    it('wraps the thread in a Section with the viewer help anchor', () => {
        const { container } = render(
            <ConversationPanel
                locale="es"
                viewer="owner"
                conversationId="c1"
                initialMessages={MESSAGES}
                canReply={false}
            />
        );
        expect(container.querySelector('[data-kit-section]')).toHaveAttribute(
            'data-help',
            'section:messages.owner-thread'
        );
        expect(screen.getByRole('heading', { level: 2, name: 'Mensajes' })).toBeInTheDocument();
    });

    it('shows no composer when the conversation does not admit a reply, and renders the children', () => {
        render(
            <ConversationPanel
                locale="es"
                viewer="guest"
                conversationId="c1"
                initialMessages={MESSAGES}
                canReply={false}
            >
                <p data-testid="listing-gone-notice">Esta ficha ya no existe.</p>
            </ConversationPanel>
        );
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByTestId('listing-gone-notice')).toBeInTheDocument();
    });

    it.each([
        'guest',
        'owner'
    ] as const)('viewer=%s: a thread without messages shows the kit EmptyState, never an empty band (HOS-2600)', (viewer) => {
        // Arrange & Act
        render(
            <ConversationPanel
                locale="es"
                viewer={viewer}
                conversationId="c1"
                initialMessages={[]}
                canReply
            />
        );

        // Assert
        expect(screen.getByText('Todavía no hay mensajes')).toBeInTheDocument();
        expect(
            screen.getByText('Cuando haya mensajes en esta conversación, los vas a ver acá.')
        ).toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('the first message sent from an empty thread replaces the EmptyState', async () => {
        // Arrange
        sendMessage.mockResolvedValue({
            ok: true,
            data: {
                id: 'srv-1',
                body: 'Primera',
                senderType: 'guest',
                createdAt: '2026-11-20T16:00:00Z'
            }
        });
        const user = userEvent.setup();
        render(
            <ConversationPanel
                locale="es"
                viewer="guest"
                conversationId="c1"
                initialMessages={[]}
                canReply
            />
        );

        // Act
        await user.type(screen.getByRole('textbox'), 'Primera');
        await user.click(screen.getByRole('button', { name: 'Enviar' }));

        // Assert
        await waitFor(() => expect(screen.getByText('Primera').closest('li')).not.toBeNull());
        expect(screen.queryByText('Todavía no hay mensajes')).not.toBeInTheDocument();
    });
});

describe('ConversationPanel — optimistic send without reload (HOS-2439)', () => {
    it('guest: appends the message at once, confirms it, and never navigates', async () => {
        // Arrange
        let resolveSend: (value: unknown) => void = () => undefined;
        sendMessage.mockReturnValue(
            new Promise((resolve) => {
                resolveSend = resolve;
            })
        );
        const user = userEvent.setup();
        render(
            <ConversationPanel
                locale="es"
                viewer="guest"
                conversationId="c1"
                initialMessages={MESSAGES}
                canReply
            />
        );

        // Act
        await user.type(screen.getByRole('textbox'), 'Nuevo mensaje');
        await user.click(screen.getByRole('button', { name: 'Enviar' }));

        // Assert: optimistic, on my side, still sending
        const bubble = screen.getByText('Nuevo mensaje').closest('li');
        expect(bubble).toHaveAttribute('data-side', 'mine');
        expect(bubble).toHaveAttribute('data-delivery', 'sending');
        expect(sendMessage).toHaveBeenCalledWith({ id: 'c1', body: 'Nuevo mensaje' });

        // Act: the API confirms
        resolveSend({
            ok: true,
            data: {
                id: 'srv-1',
                body: 'Nuevo mensaje',
                senderType: 'guest',
                createdAt: '2026-11-20T16:00:00Z'
            }
        });

        // Assert: delivered, no navigation, no reload
        await waitFor(() =>
            expect(screen.getByText('Nuevo mensaje').closest('li')).not.toHaveAttribute(
                'data-delivery'
            )
        );
        expect(window.location.href).toBe(startHref);
        expect(reload).not.toHaveBeenCalled();
        expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('owner: replies through the owner endpoint', async () => {
        ownerReply.mockResolvedValue({
            ok: true,
            data: {
                id: 'srv-2',
                body: 'Gracias',
                senderType: 'owner',
                createdAt: '2026-11-20T16:00:00Z'
            }
        });
        const user = userEvent.setup();
        render(
            <ConversationPanel
                locale="es"
                viewer="owner"
                conversationId="c7"
                initialMessages={MESSAGES}
                canReply
            />
        );
        await user.type(screen.getByRole('textbox'), 'Gracias');
        await user.click(screen.getByRole('button', { name: 'Enviar' }));
        expect(ownerReply).toHaveBeenCalledWith({ id: 'c7', message: 'Gracias' });
        expect(sendMessage).not.toHaveBeenCalled();
        expect(sideOf('Gracias')).toBe('mine');
    });

    it('a failed send keeps the message, explains why, and retries it', async () => {
        // Arrange
        sendMessage
            .mockResolvedValueOnce({ ok: false, error: { status: 500, message: 'down' } })
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    id: 'srv-3',
                    body: 'Hola',
                    senderType: 'guest',
                    createdAt: '2026-11-20T16:00:00Z'
                }
            });
        const user = userEvent.setup();
        render(
            <ConversationPanel
                locale="es"
                viewer="guest"
                conversationId="c1"
                initialMessages={MESSAGES}
                canReply
            />
        );

        // Act
        await user.type(screen.getByRole('textbox'), 'Hola');
        await user.click(screen.getByRole('button', { name: 'Enviar' }));

        // Assert: failed in place, with the reason above the composer
        const bubble = await screen.findByText('Hola');
        await waitFor(() =>
            expect(bubble.closest('li')).toHaveAttribute('data-delivery', 'failed')
        );
        expect(screen.getByText('No se pudo enviar el mensaje.')).toBeInTheDocument();

        // Act: retry from the bubble
        await user.click(
            within(bubble.closest('li') as HTMLElement).getByRole('button', { name: 'Reintentar' })
        );

        // Assert
        await waitFor(() =>
            expect(screen.getByText('Hola').closest('li')).not.toHaveAttribute('data-delivery')
        );
        expect(sendMessage).toHaveBeenCalledTimes(2);
        expect(screen.queryByText('No se pudo enviar el mensaje.')).not.toBeInTheDocument();
        expect(reload).not.toHaveBeenCalled();
    });

    it('retry does not resend a message that already landed on the server', async () => {
        // Arrange: the first POST reached the API but its response was lost
        sendMessage.mockResolvedValueOnce({ ok: false, error: { status: 0, message: 'lost' } });
        getThread.mockResolvedValue({
            ok: true,
            data: {
                messages: [
                    ...MESSAGES,
                    {
                        id: 'srv-9',
                        body: 'Hola',
                        senderType: 'guest',
                        createdAt: new Date(Date.now() + 1000).toISOString()
                    }
                ]
            }
        });
        const user = userEvent.setup();
        render(
            <ConversationPanel
                locale="es"
                viewer="guest"
                conversationId="c1"
                initialMessages={MESSAGES}
                canReply
            />
        );
        await user.type(screen.getByRole('textbox'), 'Hola');
        await user.click(screen.getByRole('button', { name: 'Enviar' }));
        const bubble = await screen.findByText('Hola');
        await waitFor(() =>
            expect(bubble.closest('li')).toHaveAttribute('data-delivery', 'failed')
        );

        // Act
        await user.click(
            within(bubble.closest('li') as HTMLElement).getByRole('button', { name: 'Reintentar' })
        );

        // Assert: settled from the server copy, POST never repeated
        await waitFor(() =>
            expect(screen.getByText('Hola').closest('li')).not.toHaveAttribute('data-delivery')
        );
        expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    it('a later success does not clear the error of another failed message', async () => {
        // Arrange
        sendMessage
            .mockResolvedValueOnce({ ok: false, error: { status: 500, message: 'down' } })
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    id: 'srv-2',
                    body: 'B',
                    senderType: 'guest',
                    createdAt: '2026-11-20T16:00:00Z'
                }
            });
        const user = userEvent.setup();
        render(
            <ConversationPanel
                locale="es"
                viewer="guest"
                conversationId="c1"
                initialMessages={MESSAGES}
                canReply
            />
        );

        // Act: A fails, B succeeds
        await user.type(screen.getByRole('textbox'), 'A');
        await user.click(screen.getByRole('button', { name: 'Enviar' }));
        await waitFor(() =>
            expect(screen.getByText('A').closest('li')).toHaveAttribute('data-delivery', 'failed')
        );
        await user.type(screen.getByRole('textbox'), 'B');
        await user.click(screen.getByRole('button', { name: 'Enviar' }));
        await waitFor(() =>
            expect(screen.getByText('B').closest('li')).not.toHaveAttribute('data-delivery')
        );

        // Assert: A is still failed and its reason is still shown
        expect(screen.getByText('A').closest('li')).toHaveAttribute('data-delivery', 'failed');
        expect(screen.getByText('No se pudo enviar el mensaje.')).toBeInTheDocument();
    });
});

describe('ConversationPanel — read receipt and older messages', () => {
    it('shows the owner read receipt until the guest writes again', async () => {
        sendMessage.mockResolvedValue({
            ok: true,
            data: { id: 's', createdAt: '2026-11-20T16:00:00Z' }
        });
        const user = userEvent.setup();
        render(
            <ConversationPanel
                locale="es"
                viewer="guest"
                conversationId="c1"
                initialMessages={MESSAGES}
                canReply
                readAt="2026-11-20T15:30:00Z"
                olderHref="/es/mi-cuenta/consultas/c1/?cursor=x"
            />
        );
        expect(screen.getByText(/Leído por el anfitrión/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Cargar mensajes anteriores' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/consultas/c1/?cursor=x'
        );
        await user.type(screen.getByRole('textbox'), 'Otra');
        await user.click(screen.getByRole('button', { name: 'Enviar' }));
        expect(screen.queryByText(/Leído por el anfitrión/)).not.toBeInTheDocument();
    });
});

describe('sendErrorMessage', () => {
    it('maps the API refusals to their reasons', () => {
        expect(sendErrorMessage({ error: { status: 429, message: '' }, locale: 'es' })).toMatch(
            /demasiados mensajes/
        );
        expect(
            sendErrorMessage({
                error: { status: 422, message: '', reason: 'MESSAGE_CONTENT_BLOCKED' },
                locale: 'es'
            })
        ).toMatch(/no permitido/);
        expect(
            sendErrorMessage({
                error: { status: 403, message: '', reason: 'CONVERSATION_BLOCKED' },
                locale: 'es'
            })
        ).toMatch(/bloqueada/);
        expect(sendErrorMessage({ error: { status: 404, message: '' }, locale: 'es' })).toMatch(
            /No se encontró/
        );
    });
});

describe('ConversationPanel — HOS-2611 thread anatomy', () => {
    it('renders the composer INSIDE the messages Section card', () => {
        // Arrange
        render(
            <ConversationPanel
                locale="es"
                viewer="guest"
                conversationId="c1"
                initialMessages={MESSAGES}
                canReply
            />
        );

        // Act
        const composer = screen.getByRole('textbox');
        const section = composer.closest('section');

        // Assert
        expect(section).not.toBeNull();
        expect(
            within(section as HTMLElement).getByText('Pregunta del huésped')
        ).toBeInTheDocument();
    });

    it('shows a visible sender label on each own and counterpart message', () => {
        // Arrange
        render(
            <ConversationPanel
                locale="es"
                viewer="owner"
                conversationId="c1"
                initialMessages={MESSAGES}
                canReply={false}
            />
        );

        // Act
        const mine = screen.getByText('Respuesta del dueño').closest('li') as HTMLElement;
        const theirs = screen.getByText('Pregunta del huésped').closest('li') as HTMLElement;

        // Assert
        expect(mine.querySelector('[aria-hidden="true"]')).toHaveTextContent('Vos');
        expect(theirs.querySelector('[aria-hidden="true"]')).toHaveTextContent('Huésped');
    });
});
