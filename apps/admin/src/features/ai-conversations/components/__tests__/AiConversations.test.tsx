// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/ai-conversations/hooks', () => ({
    useAiConversationsQuery: vi.fn(),
    useAiConversationQuery: vi.fn()
}));
vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, params }: { children: React.ReactNode; params: { id: string } }) => (
        <a href={`/ai/conversations/${params.id}`}>{children}</a>
    )
}));

import { useAiConversationQuery, useAiConversationsQuery } from '@/features/ai-conversations/hooks';
import enAdmin from '../../../../../../../packages/i18n/src/locales/en/admin-pages.json';
import esAdmin from '../../../../../../../packages/i18n/src/locales/es/admin-pages.json';
import ptAdmin from '../../../../../../../packages/i18n/src/locales/pt/admin-pages.json';
import { AiConversationsTable } from '../AiConversationsTable';
import { AiConversationTranscript } from '../AiConversationTranscript';

const listMock = vi.mocked(useAiConversationsQuery);
const detailMock = vi.mocked(useAiConversationQuery);
const ID = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('AiConversationsTable', () => {
    it('renders a row per conversation with a link to its transcript and no user column', () => {
        // Arrange
        listMock.mockReturnValue({
            data: {
                items: [
                    {
                        id: ID,
                        entityType: 'venue',
                        entityId: '22222222-2222-4222-8222-222222222222',
                        startedAt: '2026-11-01T10:00:00Z',
                        lastMessageAt: '2026-11-01T10:05:00Z',
                        messageCount: 4,
                        firstQuestion: 'Do you allow pets?'
                    }
                ],
                pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
            },
            isLoading: false,
            isError: false
        } as unknown as ReturnType<typeof useAiConversationsQuery>);

        // Act
        render(
            <AiConversationsTable
                search={{ page: 1, pageSize: 20 }}
                onPageChange={() => undefined}
            />
        );

        // Assert
        const link = screen.getByText('Do you allow pets?');
        expect(link.closest('a')?.getAttribute('href')).toBe(`/ai/conversations/${ID}`);
        expect(screen.getByText('4')).toBeTruthy();
        expect(screen.queryByText(/user|email/i)).toBeNull();
    });

    it('renders the empty state', () => {
        listMock.mockReturnValue({
            data: { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
            isLoading: false,
            isError: false
        } as unknown as ReturnType<typeof useAiConversationsQuery>);
        render(
            <AiConversationsTable
                search={{ page: 1, pageSize: 20 }}
                onPageChange={() => undefined}
            />
        );
        expect(screen.getByText('admin-pages.ai.conversations.empty')).toBeTruthy();
    });
});

describe('AiConversationTranscript', () => {
    it('renders turns in the order received, tagged by role', () => {
        detailMock.mockReturnValue({
            data: {
                id: ID,
                entityType: 'accommodation',
                entityId: '22222222-2222-4222-8222-222222222222',
                startedAt: '2026-11-01T10:00:00Z',
                turns: [
                    { id: 'a', role: 'user', content: 'first', createdAt: '2026-11-01T10:00:00Z' },
                    {
                        id: 'b',
                        role: 'assistant',
                        content: 'second',
                        createdAt: '2026-11-01T10:00:05Z'
                    },
                    { id: 'c', role: 'user', content: 'third', createdAt: '2026-11-01T10:01:00Z' }
                ]
            },
            isLoading: false,
            isError: false
        } as unknown as ReturnType<typeof useAiConversationQuery>);

        render(<AiConversationTranscript id={ID} />);

        const items = screen.getAllByRole('listitem');
        expect(items.map((i) => i.querySelector('div')?.textContent)).toEqual([
            'first',
            'second',
            'third'
        ]);
        expect(items.map((i) => i.getAttribute('data-role'))).toEqual([
            'user',
            'assistant',
            'user'
        ]);
    });

    it('renders an error state', () => {
        detailMock.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true
        } as unknown as ReturnType<typeof useAiConversationQuery>);
        render(<AiConversationTranscript id={ID} />);
        expect(screen.getByRole('alert')).toBeTruthy();
    });
});

describe('conversation vertical labels (HOS-2319)', () => {
    const locales = [
        {
            locale: 'es',
            messages: esAdmin,
            venue: 'Comer y salir',
            staleSubtitle: /alojamiento\./i
        },
        {
            locale: 'en',
            messages: enAdmin,
            venue: 'Food & nightlife',
            staleSubtitle: /accommodation\./i
        },
        { locale: 'pt', messages: ptAdmin, venue: 'Comer e sair', staleSubtitle: /anúncio\./i }
    ] as const;

    it.each(locales)('labels the venue vertical as the catalog does in $locale', (row) => {
        expect(row.messages.ai.conversations.verticals.venue).toBe(row.venue);
    });

    it.each(locales)('keeps the subtitle vertical-neutral in $locale', (row) => {
        expect(row.messages.ai.conversations.subtitle).not.toMatch(row.staleSubtitle);
    });
});
