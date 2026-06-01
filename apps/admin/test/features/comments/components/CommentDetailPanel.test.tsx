/**
 * @file CommentDetailPanel.test.tsx
 * @description Tests for the CommentDetailPanel component (SPEC-165 T-018).
 *
 * Verifies:
 * - Full content rendered (no truncation)
 * - Author name displayed; link to user page when authorId present
 * - Entity type badge and entity link present
 * - Metadata section: moderationState badge, createdAt, updatedAt
 * - Restore button shown ONLY when deletedAt is set
 * - Hard-delete button opens the AlertDialog
 * - Action buttons call the correct mutation hooks
 */

import { CommentDetailPanel } from '@/components/comments/CommentDetailPanel';
import { EntityTypeEnum, ModerationStatusEnum } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockModerate = vi.fn();
const mockSoftDelete = vi.fn();
const mockHardDelete = vi.fn();
const mockRestore = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/hooks/use-comment-moderation', () => ({
    useModerateComment: () => ({ mutate: mockModerate, isPending: false }),
    useSoftDeleteComment: () => ({ mutate: mockSoftDelete, isPending: false }),
    useHardDeleteComment: () => ({ mutate: mockHardDelete, isPending: false }),
    useRestoreComment: () => ({ mutate: mockRestore, isPending: false })
}));

// Override the global @tanstack/react-router mock (from setup.tsx) to add useNavigate.
// We must NOT spread the real module (it breaks in jsdom — Link needs router context).
// Replicate the same shape the setup.tsx mock provides, plus useNavigate.
vi.mock('@tanstack/react-router', () => ({
    useRouter: () => ({ navigate: vi.fn(), history: { push: vi.fn(), replace: vi.fn() } }),
    useNavigate: () => mockNavigate,
    useSearch: () => ({ page: 1, pageSize: 20 }),
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

const baseComment = {
    id: 'comment-uuid-001',
    entityType: EntityTypeEnum.POST,
    entityId: 'entity-uuid-001',
    authorId: 'author-uuid-001',
    authorName: 'María López',
    content: 'Este es el contenido completo del comentario sin truncamiento alguno.',
    moderationState: ModerationStatusEnum.APPROVED,
    createdAt: new Date('2025-06-01T10:00:00Z'),
    updatedAt: new Date('2025-06-01T11:00:00Z'),
    createdById: 'author-uuid-001',
    updatedById: null,
    deletedAt: null,
    deletedById: null
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommentDetailPanel', () => {
    describe('Content section', () => {
        it('renders the full comment content without truncation', () => {
            render(<CommentDetailPanel comment={baseComment} />);
            expect(screen.getByText(baseComment.content)).toBeInTheDocument();
        });
    });

    describe('Author section', () => {
        it('displays the author name', () => {
            render(<CommentDetailPanel comment={baseComment} />);
            expect(screen.getByText('María López')).toBeInTheDocument();
        });

        it('renders a link to the user page when authorId is present', () => {
            render(<CommentDetailPanel comment={baseComment} />);
            const link = screen.getByTestId('author-link');
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute('href', expect.stringContaining('access/users'));
        });

        it('renders author name without link when authorId is null', () => {
            const comment = { ...baseComment, authorId: null };
            render(<CommentDetailPanel comment={comment} />);
            expect(screen.getByText('María López')).toBeInTheDocument();
            expect(screen.queryByTestId('author-link')).not.toBeInTheDocument();
        });
    });

    describe('Entity section', () => {
        it('shows the entity type badge', () => {
            render(<CommentDetailPanel comment={baseComment} />);
            expect(screen.getByText('POST')).toBeInTheDocument();
        });

        it('renders a link to the post page for POST entityType', () => {
            render(<CommentDetailPanel comment={baseComment} />);
            const link = screen.getByTestId('entity-link');
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute('href', expect.stringContaining('posts'));
        });

        it('renders a link to the event page for EVENT entityType', () => {
            const comment = { ...baseComment, entityType: EntityTypeEnum.EVENT };
            render(<CommentDetailPanel comment={comment} />);
            const link = screen.getByTestId('entity-link');
            expect(link).toHaveAttribute('href', expect.stringContaining('events'));
        });
    });

    describe('Metadata section', () => {
        it('displays the moderationState badge', () => {
            render(<CommentDetailPanel comment={baseComment} />);
            // ModerationStateBadge renders, check it's present by testid or text
            expect(screen.getByText('Estado:')).toBeInTheDocument();
        });

        it('displays createdAt date', () => {
            render(<CommentDetailPanel comment={baseComment} />);
            expect(screen.getByText('Creado:')).toBeInTheDocument();
        });

        it('displays updatedAt date', () => {
            render(<CommentDetailPanel comment={baseComment} />);
            expect(screen.getByText('Actualizado:')).toBeInTheDocument();
        });

        it('shows the deleted date when comment is soft-deleted', () => {
            const comment = {
                ...baseComment,
                deletedAt: new Date('2025-06-02T00:00:00Z')
            };
            render(<CommentDetailPanel comment={comment} />);
            expect(screen.getByText('Eliminado:')).toBeInTheDocument();
        });
    });

    describe('Restore button visibility', () => {
        it('does NOT show Restore when deletedAt is null', () => {
            render(<CommentDetailPanel comment={baseComment} />);
            expect(screen.queryByTestId('detail-restore-btn')).not.toBeInTheDocument();
        });

        it('shows Restore when deletedAt is set', () => {
            const comment = {
                ...baseComment,
                deletedAt: new Date('2025-06-02T00:00:00Z')
            };
            render(<CommentDetailPanel comment={comment} />);
            expect(screen.getByTestId('detail-restore-btn')).toBeInTheDocument();
        });
    });

    describe('Action buttons', () => {
        it('calls useModerateComment with APPROVED when Approve is clicked', async () => {
            const user = userEvent.setup();
            const comment = { ...baseComment, moderationState: ModerationStatusEnum.PENDING };
            render(<CommentDetailPanel comment={comment} />);

            await user.click(screen.getByTestId('detail-approve-btn'));
            expect(mockModerate).toHaveBeenCalledWith({
                id: 'comment-uuid-001',
                moderationState: 'APPROVED'
            });
        });

        it('calls useModerateComment with REJECTED when Reject is clicked', async () => {
            const user = userEvent.setup();
            const comment = { ...baseComment, moderationState: ModerationStatusEnum.PENDING };
            render(<CommentDetailPanel comment={comment} />);

            await user.click(screen.getByTestId('detail-reject-btn'));
            expect(mockModerate).toHaveBeenCalledWith({
                id: 'comment-uuid-001',
                moderationState: 'REJECTED'
            });
        });

        it('calls useSoftDeleteComment when Delete is clicked', async () => {
            const user = userEvent.setup();
            render(<CommentDetailPanel comment={baseComment} />);

            await user.click(screen.getByTestId('detail-delete-btn'));
            expect(mockSoftDelete).toHaveBeenCalledWith('comment-uuid-001');
        });

        it('calls useRestoreComment when Restore is clicked (deleted comment)', async () => {
            const user = userEvent.setup();
            const comment = {
                ...baseComment,
                deletedAt: new Date('2025-06-02T00:00:00Z')
            };
            render(<CommentDetailPanel comment={comment} />);

            await user.click(screen.getByTestId('detail-restore-btn'));
            expect(mockRestore).toHaveBeenCalledWith('comment-uuid-001');
        });

        it('opens the hard-delete AlertDialog when Hard-delete button is clicked', async () => {
            const user = userEvent.setup();
            render(<CommentDetailPanel comment={baseComment} />);

            await user.click(screen.getByTestId('detail-hard-delete-btn'));
            // DeleteConfirmDialog renders with data-testid="delete-confirm-dialog"
            expect(screen.getByTestId('delete-confirm-dialog')).toBeInTheDocument();
        });

        it('disables Approve button when comment is already APPROVED', () => {
            render(<CommentDetailPanel comment={baseComment} />);
            expect(screen.getByTestId('detail-approve-btn')).toBeDisabled();
        });

        it('disables Reject button when comment is already REJECTED', () => {
            const comment = { ...baseComment, moderationState: ModerationStatusEnum.REJECTED };
            render(<CommentDetailPanel comment={comment} />);
            expect(screen.getByTestId('detail-reject-btn')).toBeDisabled();
        });
    });
});
