// @vitest-environment jsdom
/**
 * Smoke tests for the SocialPostsTable component (SPEC-254 T-039).
 *
 * Strategy:
 * - Mock `useApproveSocialPost` to control mutation state.
 * - Mock `useUserPermissions` to control permission gate behavior.
 * - Mock `useTranslations` to return predictable strings.
 * - Wrap renders in QueryClientProvider so TanStack Query hooks work.
 *
 * Covers:
 * - Table renders rows when data is present.
 * - Empty table (0 items) produces no post-row nodes.
 * - Platform icons render with data-testid for accessibility verification.
 * - Status badge renders per post.
 * - Approval status badge renders per post.
 * - Approve button is hidden when user lacks SOCIAL_POST_APPROVE permission.
 * - Approve button is present when user has SOCIAL_POST_APPROVE permission.
 * - Approve button is disabled when post is already approved.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before component imports
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-social-posts', () => ({
    useSocialPostsList: vi.fn(),
    useApproveSocialPost: vi.fn()
}));

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({ isLoading: false, user: null }),
    useHasPermission: vi.fn(() => true),
    useHasRole: vi.fn(() => false),
    useHasAnyRole: vi.fn(() => false)
}));

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: vi.fn()
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        tPlural: (key: string) => key
    })
}));

vi.mock('@repo/icons', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/icons')>()),
    InstagramIcon: ({ className }: { className?: string }) => (
        <svg
            data-testid="instagram-icon"
            className={className}
            aria-hidden="true"
        />
    ),
    FacebookIcon: ({ className }: { className?: string }) => (
        <svg
            data-testid="facebook-icon"
            className={className}
            aria-hidden="true"
        />
    ),
    XIcon: ({ className }: { className?: string }) => (
        <svg
            data-testid="x-icon"
            className={className}
            aria-hidden="true"
        />
    )
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useApproveSocialPost } from '@/hooks/use-social-posts';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { PermissionEnum } from '@repo/schemas';
import type { SocialPostListItem } from '@repo/service-core';
import { SocialPostsTable } from '../-components/SocialPostsTable';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, refetchOnWindowFocus: false, refetchOnMount: false }
        }
    });
}

function TestWrapper({ children }: { readonly children: ReactNode }) {
    const qc = makeQueryClient();
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function makePost(overrides: Partial<SocialPostListItem> = {}): SocialPostListItem {
    return {
        id: 'post-1',
        title: 'Test social post',
        slug: 'test-social-post',
        status: 'NEEDS_REVIEW',
        approvalStatus: 'PENDING',
        paused: false,
        platforms: ['INSTAGRAM', 'FACEBOOK'],
        thumbnailUrl: null,
        scheduledAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        ...overrides
    };
}

const mockUseApproveSocialPost = vi.mocked(useApproveSocialPost);
const mockUseUserPermissions = vi.mocked(useUserPermissions);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SocialPostsTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseApproveSocialPost.mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
            variables: undefined
        } as unknown as ReturnType<typeof useApproveSocialPost>);
        mockUseUserPermissions.mockReturnValue([
            PermissionEnum.SOCIAL_POST_VIEW,
            PermissionEnum.SOCIAL_POST_APPROVE
        ]);
    });

    // -- Table renders -----------------------------------------------------------

    it('renders a row for each post item', () => {
        const posts = [
            makePost({ id: 'p-1', title: 'Post One' }),
            makePost({ id: 'p-2', title: 'Post Two' })
        ];

        render(
            <TestWrapper>
                <SocialPostsTable items={posts} />
            </TestWrapper>
        );

        expect(screen.getByTestId('post-row-p-1')).toBeInTheDocument();
        expect(screen.getByTestId('post-row-p-2')).toBeInTheDocument();
    });

    it('renders no rows for an empty items array', () => {
        render(
            <TestWrapper>
                <SocialPostsTable items={[]} />
            </TestWrapper>
        );

        expect(screen.queryByTestId(/^post-row-/)).toBeNull();
    });

    // -- Platform icons ----------------------------------------------------------

    it('renders platform icons with data-testid for each platform', () => {
        const posts = [makePost({ id: 'p-1', platforms: ['INSTAGRAM', 'FACEBOOK'] })];

        render(
            <TestWrapper>
                <SocialPostsTable items={posts} />
            </TestWrapper>
        );

        expect(screen.getByTestId('platform-icon-INSTAGRAM')).toBeInTheDocument();
        expect(screen.getByTestId('platform-icon-FACEBOOK')).toBeInTheDocument();
    });

    it('renders aria-label on platform icon wrappers', () => {
        const posts = [makePost({ id: 'p-1', platforms: ['INSTAGRAM'] })];

        render(
            <TestWrapper>
                <SocialPostsTable items={posts} />
            </TestWrapper>
        );

        // The aria-label lives on the <span> wrapping the icon
        expect(screen.getByLabelText('Instagram')).toBeInTheDocument();
    });

    // -- Status badges -----------------------------------------------------------

    it('renders pipeline status badge with the correct status value', () => {
        const posts = [makePost({ id: 'p-1', status: 'NEEDS_REVIEW' })];

        render(
            <TestWrapper>
                <SocialPostsTable items={posts} />
            </TestWrapper>
        );

        expect(screen.getByTestId('status-badge-NEEDS_REVIEW')).toBeInTheDocument();
    });

    it('renders approval status badge with the correct value', () => {
        const posts = [makePost({ id: 'p-1', approvalStatus: 'PENDING' })];

        render(
            <TestWrapper>
                <SocialPostsTable items={posts} />
            </TestWrapper>
        );

        expect(screen.getByTestId('approval-badge-PENDING')).toBeInTheDocument();
    });

    // -- Permission-gated approve button -----------------------------------------

    it('hides approve button when user lacks SOCIAL_POST_APPROVE permission', () => {
        mockUseUserPermissions.mockReturnValue([PermissionEnum.SOCIAL_POST_VIEW]);

        const posts = [makePost({ id: 'p-1' })];

        render(
            <TestWrapper>
                <SocialPostsTable items={posts} />
            </TestWrapper>
        );

        expect(screen.queryByTestId('approve-btn-p-1')).not.toBeInTheDocument();
    });

    it('shows approve button when user has SOCIAL_POST_APPROVE permission', () => {
        mockUseUserPermissions.mockReturnValue([
            PermissionEnum.SOCIAL_POST_VIEW,
            PermissionEnum.SOCIAL_POST_APPROVE
        ]);

        const posts = [makePost({ id: 'p-1' })];

        render(
            <TestWrapper>
                <SocialPostsTable items={posts} />
            </TestWrapper>
        );

        expect(screen.getByTestId('approve-btn-p-1')).toBeInTheDocument();
    });

    it('disables approve button when post is already approved', () => {
        mockUseUserPermissions.mockReturnValue([
            PermissionEnum.SOCIAL_POST_VIEW,
            PermissionEnum.SOCIAL_POST_APPROVE
        ]);

        const posts = [makePost({ id: 'p-1', approvalStatus: 'APPROVED' })];

        render(
            <TestWrapper>
                <SocialPostsTable items={posts} />
            </TestWrapper>
        );

        const btn = screen.getByTestId('approve-btn-p-1');
        expect(btn).toBeDisabled();
    });

    it('approve button is enabled for a post with PENDING approval status', () => {
        mockUseUserPermissions.mockReturnValue([
            PermissionEnum.SOCIAL_POST_VIEW,
            PermissionEnum.SOCIAL_POST_APPROVE
        ]);

        const posts = [makePost({ id: 'p-1', approvalStatus: 'PENDING' })];

        render(
            <TestWrapper>
                <SocialPostsTable items={posts} />
            </TestWrapper>
        );

        const btn = screen.getByTestId('approve-btn-p-1');
        expect(btn).not.toBeDisabled();
    });
});
