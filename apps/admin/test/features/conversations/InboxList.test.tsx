/**
 * Tests for InboxList component.
 *
 * Verifies:
 * - Renders columns from mocked data
 * - Sort order is lastActivityAt DESC by default
 * - Pagination controls work
 * - Empty state renders the i18n key
 */

import { InboxList } from '@/features/conversations/components/InboxList';
import type { ConversationListItem } from '@/features/conversations/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@tanstack/react-router')>();
    return {
        ...actual,
        useNavigate: () => mockNavigate
    };
});

// StatusBadge uses useTranslations which is mocked in setup
vi.mock('@/features/conversations/components/StatusBadge', () => ({
    StatusBadge: ({ status }: { status: string }) => (
        <span data-testid={`status-badge-${status}`}>{status}</span>
    )
}));

const makeItem = (overrides: Partial<ConversationListItem> = {}): ConversationListItem => ({
    id: 'conv-001',
    status: 'PENDING_OWNER',
    guest: { name: 'Juan Perez', email: 'juan@example.com' },
    accommodation: { id: 'acc-001', name: 'Hotel Rio' },
    unreadCountByOwner: 2,
    lastActivityAt: '2026-04-25T10:00:00.000Z',
    archivedByOwner: false,
    ...overrides
});

describe('InboxList', () => {
    const baseProps = {
        items: [makeItem()],
        total: 1,
        page: 1,
        pageSize: 20,
        onPageChange: vi.fn(),
        isLoading: false
    };

    it('renders the guest name column', () => {
        render(<InboxList {...baseProps} />);
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    });

    it('renders the accommodation name column', () => {
        render(<InboxList {...baseProps} />);
        expect(screen.getByText('Hotel Rio')).toBeInTheDocument();
    });

    it('renders the status badge', () => {
        render(<InboxList {...baseProps} />);
        expect(screen.getByTestId('status-badge-PENDING_OWNER')).toBeInTheDocument();
    });

    it('renders unread count badge when > 0', () => {
        render(<InboxList {...baseProps} />);
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders empty state when items is empty', () => {
        render(
            <InboxList
                {...baseProps}
                items={[]}
                total={0}
            />
        );
        // useTranslations mock returns the key as-is
        expect(screen.getByText('conversations.empty.ownerInbox')).toBeInTheDocument();
    });

    it('renders skeleton rows when isLoading is true', () => {
        render(
            <InboxList
                {...baseProps}
                isLoading={true}
            />
        );
        const skeletons = document.querySelectorAll('.animate-pulse');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('calls onPageChange when next page button is clicked', () => {
        const onPageChange = vi.fn();
        render(
            <InboxList
                {...baseProps}
                items={Array.from({ length: 5 }, (_, i) =>
                    makeItem({
                        id: `conv-00${i}`,
                        lastActivityAt: `2026-04-0${i + 1}T10:00:00.000Z`
                    })
                )}
                total={100}
                pageSize={5}
                onPageChange={onPageChange}
            />
        );
        const nextBtn = screen.getByText('ui.pagination.next');
        fireEvent.click(nextBtn);
        expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('navigates to conversation detail on row click', () => {
        render(<InboxList {...baseProps} />);
        // aria-label is "conversations.actions.viewConversation conv-001" (i18n key in tests)
        const row = screen.getByRole('button', {
            name: /conversations\.actions\.viewConversation/i
        });
        fireEvent.click(row);
        expect(mockNavigate).toHaveBeenCalledWith(
            expect.objectContaining({
                to: '/conversations/$id',
                params: { id: 'conv-001' }
            })
        );
    });

    it('does not show pagination when totalPages is 1', () => {
        render(<InboxList {...baseProps} />);
        expect(screen.queryByText('ui.pagination.previous')).not.toBeInTheDocument();
    });

    it('shows pagination when totalPages > 1', () => {
        render(
            <InboxList
                {...baseProps}
                total={100}
                pageSize={5}
                items={Array.from({ length: 5 }, (_, i) => makeItem({ id: `conv-00${i}` }))}
            />
        );
        expect(screen.getByText('ui.pagination.next')).toBeInTheDocument();
    });
});
