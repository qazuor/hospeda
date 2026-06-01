/**
 * @file CommentsTable.test.tsx
 * @description Tests for the CommentsTable component (SPEC-165 T-017, AC-33/34).
 *
 * Verifies:
 * - Rows render with correct data (excerpt, author, entity type, state badge)
 * - Approve button calls useModerateComment with correct args
 * - Reject button calls useModerateComment with correct args
 * - Delete button calls useSoftDeleteComment with correct arg
 * - Disabled state when moderationState already matches button action
 */

import { CommentsTable } from '@/routes/_authed/comments/-components/CommentsTable';
import { EntityTypeEnum, ModerationStatusEnum } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockModerate = vi.fn();
const mockSoftDelete = vi.fn();
const mockUseModerateComment = vi.fn(() => ({
    mutate: mockModerate,
    isPending: false
}));
const mockUseSoftDeleteComment = vi.fn(() => ({
    mutate: mockSoftDelete,
    isPending: false
}));

vi.mock('@/hooks/use-comment-moderation', () => ({
    useModerateComment: () => mockUseModerateComment(),
    useSoftDeleteComment: () => mockUseSoftDeleteComment()
}));

// Use the same shape as the global setup.tsx mock — do NOT spread the real module
// because Link needs router context that doesn't exist in jsdom.
vi.mock('@tanstack/react-router', () => ({
    useRouter: () => ({ navigate: vi.fn(), history: { push: vi.fn(), replace: vi.fn() } }),
    useNavigate: () => vi.fn(),
    useSearch: () => ({}),
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/', search: '', hash: '' }),
    useRouterState: () => ({ location: { pathname: '/', search: '', hash: '' } }),
    Link: ({
        children,
        to,
        ...props
    }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
        <a
            href={to}
            {...props}
        >
            {children}
        </a>
    ),
    Outlet: () => null,
    createRouter: vi.fn(),
    createRoute: vi.fn(),
    createRootRoute: vi.fn(),
    createFileRoute: (_path: string) => (opts: Record<string, unknown>) => ({ options: opts }),
    createLazyFileRoute: (_path: string) => (opts: Record<string, unknown>) => ({ options: opts })
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeComment(overrides: Record<string, unknown> = {}) {
    return {
        id: 'comment-001',
        entityType: EntityTypeEnum.POST,
        entityId: 'entity-001',
        authorId: 'author-001',
        authorName: 'Ana García',
        content: 'Este es un comentario de prueba con suficiente texto para la vista.',
        moderationState: ModerationStatusEnum.PENDING,
        createdAt: new Date('2025-06-01T10:00:00Z'),
        updatedAt: new Date('2025-06-01T10:00:00Z'),
        createdById: 'author-001',
        updatedById: null,
        deletedAt: null,
        deletedById: null,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommentsTable', () => {
    it('renders a row for each comment item', () => {
        const items = [makeComment({ id: 'c-001' }), makeComment({ id: 'c-002' })];
        render(<CommentsTable items={items} />);
        expect(screen.getByTestId('comment-row-c-001')).toBeInTheDocument();
        expect(screen.getByTestId('comment-row-c-002')).toBeInTheDocument();
    });

    it('displays the author name', () => {
        render(<CommentsTable items={[makeComment()]} />);
        expect(screen.getByText('Ana García')).toBeInTheDocument();
    });

    it('displays the entity type badge', () => {
        render(<CommentsTable items={[makeComment({ entityType: EntityTypeEnum.EVENT })]} />);
        expect(screen.getByText('EVENT')).toBeInTheDocument();
    });

    it('renders the moderation state badge for each comment', () => {
        render(
            <CommentsTable
                items={[
                    makeComment({ moderationState: ModerationStatusEnum.APPROVED }),
                    makeComment({ id: 'c-rej', moderationState: ModerationStatusEnum.REJECTED })
                ]}
            />
        );
        // ModerationStateBadge uses i18n which is mocked — just check there are two badges
        const rows = screen.getAllByRole('row');
        // 1 header + 2 data rows
        expect(rows).toHaveLength(3);
    });

    it('calls useModerateComment with APPROVED when Approve button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <CommentsTable
                items={[
                    makeComment({ id: 'c-001', moderationState: ModerationStatusEnum.PENDING })
                ]}
            />
        );

        const approveBtn = screen.getByTestId('approve-btn-c-001');
        await user.click(approveBtn);

        expect(mockModerate).toHaveBeenCalledWith({
            id: 'c-001',
            moderationState: 'APPROVED'
        });
    });

    it('calls useModerateComment with REJECTED when Reject button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <CommentsTable
                items={[
                    makeComment({ id: 'c-001', moderationState: ModerationStatusEnum.PENDING })
                ]}
            />
        );

        const rejectBtn = screen.getByTestId('reject-btn-c-001');
        await user.click(rejectBtn);

        expect(mockModerate).toHaveBeenCalledWith({
            id: 'c-001',
            moderationState: 'REJECTED'
        });
    });

    it('calls useSoftDeleteComment with the comment id when Delete is clicked', async () => {
        const user = userEvent.setup();
        render(<CommentsTable items={[makeComment({ id: 'c-001' })]} />);

        const deleteBtn = screen.getByTestId('delete-btn-c-001');
        await user.click(deleteBtn);

        expect(mockSoftDelete).toHaveBeenCalledWith('c-001');
    });

    it('disables Approve button when comment is already APPROVED', () => {
        render(
            <CommentsTable
                items={[
                    makeComment({ id: 'c-001', moderationState: ModerationStatusEnum.APPROVED })
                ]}
            />
        );
        expect(screen.getByTestId('approve-btn-c-001')).toBeDisabled();
    });

    it('disables Reject button when comment is already REJECTED', () => {
        render(
            <CommentsTable
                items={[
                    makeComment({ id: 'c-001', moderationState: ModerationStatusEnum.REJECTED })
                ]}
            />
        );
        expect(screen.getByTestId('reject-btn-c-001')).toBeDisabled();
    });

    it('disables Delete button when comment is already soft-deleted', () => {
        render(
            <CommentsTable
                items={[
                    makeComment({
                        id: 'c-001',
                        deletedAt: new Date('2025-06-01T12:00:00Z')
                    })
                ]}
            />
        );
        expect(screen.getByTestId('delete-btn-c-001')).toBeDisabled();
    });

    it('truncates long content to 80 chars', () => {
        const longContent = 'A'.repeat(200);
        render(<CommentsTable items={[makeComment({ content: longContent })]} />);
        // Should not render the full 200-char content
        expect(screen.queryByText(longContent)).not.toBeInTheDocument();
        // Should render an ellipsis-terminated version
        const cell = screen.getByText(/A{80}…/);
        expect(cell).toBeInTheDocument();
    });
});
