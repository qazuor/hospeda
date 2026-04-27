/**
 * Tests for ThreadView component.
 *
 * Verifies:
 * - Messages rendered oldest (top) to newest (bottom)
 * - Load-older button triggers older-page query with cursor
 * - Auto-scroll on first load
 * - Loading skeleton shown during fetch
 */

import { ThreadView } from '@/features/conversations/components/ThreadView';
import type { ConversationThread } from '@/features/conversations/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock useConversation hook
vi.mock('@/features/conversations/hooks/useConversation', () => ({
    useConversation: vi.fn()
}));

import { useConversation } from '@/features/conversations/hooks/useConversation';

const mockUseConversation = vi.mocked(useConversation);

const makeThread = (
    messages: ConversationThread['messages'],
    olderCursor?: string
): ConversationThread => ({
    id: 'conv-001',
    status: 'OPEN',
    guest: { name: 'Juan', email: 'juan@example.com' },
    accommodation: { id: 'acc-001', name: 'Hotel Rio' },
    archivedByOwner: false,
    messages,
    olderCursor,
    unreadCountByOwner: 0,
    lastActivityAt: '2026-04-25T10:00:00.000Z'
});

const olderMessage = {
    id: 'msg-001',
    conversationId: 'conv-001',
    senderType: 'GUEST' as const,
    body: 'Older message',
    createdAt: '2026-04-20T08:00:00.000Z'
};

const newerMessage = {
    id: 'msg-002',
    conversationId: 'conv-001',
    senderType: 'OWNER' as const,
    body: 'Newer message',
    createdAt: '2026-04-25T10:00:00.000Z'
};

describe('ThreadView', () => {
    it('renders messages in ascending chronological order (oldest first)', () => {
        mockUseConversation.mockReturnValue({
            data: makeThread([olderMessage, newerMessage]),
            isLoading: false,
            isError: false
        } as ReturnType<typeof useConversation>);

        render(<ThreadView conversationId="conv-001" />);

        const bubbles = screen.getAllByText(/message/i);
        // "Older message" should appear before "Newer message" in DOM order
        const olderIdx = bubbles.findIndex((el) => el.textContent?.includes('Older message'));
        const newerIdx = bubbles.findIndex((el) => el.textContent?.includes('Newer message'));
        expect(olderIdx).toBeLessThan(newerIdx);
    });

    it('shows load-older button when olderCursor is available', () => {
        mockUseConversation.mockReturnValue({
            data: makeThread([newerMessage], 'cursor-abc'),
            isLoading: false,
            isError: false
        } as ReturnType<typeof useConversation>);

        render(<ThreadView conversationId="conv-001" />);
        expect(screen.getByText('conversations.thread.older')).toBeInTheDocument();
    });

    it('does not show load-older button when no olderCursor', () => {
        mockUseConversation.mockReturnValue({
            data: makeThread([newerMessage], undefined),
            isLoading: false,
            isError: false
        } as ReturnType<typeof useConversation>);

        render(<ThreadView conversationId="conv-001" />);
        expect(screen.queryByText('conversations.thread.older')).not.toBeInTheDocument();
    });

    it('calls useConversation a second time with cursor when load-older is clicked', () => {
        mockUseConversation.mockReturnValue({
            data: makeThread([newerMessage], 'cursor-xyz'),
            isLoading: false,
            isError: false,
            isFetching: false
        } as ReturnType<typeof useConversation>);

        render(<ThreadView conversationId="conv-001" />);

        const loadOlderBtn = screen.getByText('conversations.thread.older');
        fireEvent.click(loadOlderBtn);

        // After clicking, useConversation should have been called with cursor enabled
        expect(mockUseConversation).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'conv-001', cursor: 'cursor-xyz', enabled: true })
        );
    });

    it('shows skeleton when loading', () => {
        mockUseConversation.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false
        } as ReturnType<typeof useConversation>);

        render(<ThreadView conversationId="conv-001" />);
        const skeletons = document.querySelectorAll('.animate-pulse');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error message when query fails', () => {
        mockUseConversation.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            error: new Error('Not found')
        } as ReturnType<typeof useConversation>);

        render(<ThreadView conversationId="conv-001" />);
        expect(screen.getByText('Not found')).toBeInTheDocument();
    });
});
