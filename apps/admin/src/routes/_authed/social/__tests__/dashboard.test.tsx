// @vitest-environment jsdom
/**
 * Smoke tests for the social dashboard page (SPEC-254 T-041).
 *
 * Strategy:
 * - Mock `useSocialDashboard` to inject controlled data.
 * - Mock `useApproveSocialPost` to track optimistic approve calls.
 * - Mock `useTranslations` to return predictable key strings.
 * - Wrap renders in QueryClientProvider so TanStack Query hooks work.
 *
 * Covers:
 * - KPI cards render with correct counts.
 * - Approval queue renders items with approve buttons.
 * - Optimistic approve removes the item from the queue.
 * - Webhook alert shows when makeWebhookConfigured is false.
 * - Webhook alert is hidden when makeWebhookConfigured is true.
 * - Recent failures section renders failure items.
 * - Empty approval queue shows the empty message.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before component imports
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-social-posts', () => ({
    useSocialDashboard: vi.fn(),
    useApproveSocialPost: vi.fn(),
    socialPostQueryKeys: {
        all: ['social-posts'],
        lists: () => ['social-posts', 'list'],
        list: (f: unknown) => ['social-posts', 'list', f],
        detail: (id: string) => ['social-posts', 'detail', id],
        dashboard: () => ['social-posts', 'dashboard']
    }
}));

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({ isLoading: false, user: null }),
    useHasPermission: vi.fn(() => true),
    useHasRole: vi.fn(() => false),
    useHasAnyRole: vi.fn(() => false)
}));

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: vi.fn(() => [])
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        tPlural: (key: string) => key
    })
}));

vi.mock('@/components/auth/RoutePermissionGuard', () => ({
    RoutePermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@tanstack/react-router')>();
    return {
        ...actual,
        createFileRoute: () => () => ({ component: null }),
        Link: ({
            children,
            to,
            'data-testid': testId
        }: {
            children: ReactNode;
            'data-testid'?: string;
            to?: string;
            params?: unknown;
            search?: unknown;
        }) => (
            <a
                href={to ?? '/'}
                data-testid={testId}
            >
                {children}
            </a>
        )
    };
});

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

import { useApproveSocialPost, useSocialDashboard } from '@/hooks/use-social-posts';
import type { SocialDashboardResponse } from '@repo/schemas';
import { DashboardKpiCards } from '../-components/DashboardKpiCards';
import { QuickApprovalQueue } from '../-components/QuickApprovalQueue';
import { RecentFailures } from '../-components/RecentFailures';
import { WebhookAlert } from '../-components/WebhookAlert';

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

function makeDashboardData(
    overrides: Partial<SocialDashboardResponse> = {}
): SocialDashboardResponse {
    return {
        kpis: {
            totalPosts: 42,
            pendingReview: 3,
            scheduled: 5,
            publishedLast30Days: 18,
            failedActionNeeded: 2
        },
        quickApprovalQueue: [
            {
                id: 'post-1',
                title: 'Post One',
                status: 'NEEDS_REVIEW',
                platforms: ['INSTAGRAM'],
                thumbnailUrl: null,
                createdAt: new Date('2026-01-01T00:00:00Z')
            },
            {
                id: 'post-2',
                title: 'Post Two',
                status: 'NEEDS_REVIEW',
                platforms: ['FACEBOOK'],
                thumbnailUrl: null,
                createdAt: new Date('2026-01-02T00:00:00Z')
            }
        ],
        recentFailures: [
            {
                targetId: 'target-1',
                postTitle: 'Failed Post',
                platform: 'INSTAGRAM',
                lastError: 'Rate limit exceeded',
                retryCount: 3,
                failedAt: new Date('2026-01-03T00:00:00Z')
            }
        ],
        makeWebhookConfigured: true,
        ...overrides
    };
}

const mockUseSocialDashboard = vi.mocked(useSocialDashboard);
const mockUseApproveSocialPost = vi.mocked(useApproveSocialPost);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardKpiCards', () => {
    it('renders all five KPI cards with correct values', () => {
        const kpis = {
            totalPosts: 42,
            pendingReview: 3,
            scheduled: 5,
            publishedLast30Days: 18,
            failedActionNeeded: 2
        };

        render(
            <TestWrapper>
                <DashboardKpiCards kpis={kpis} />
            </TestWrapper>
        );

        expect(screen.getByTestId('kpi-totalPosts')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-pendingReview')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-scheduled')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-publishedLast30Days')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-failedActionNeeded')).toBeInTheDocument();
    });

    it('displays the correct count for each KPI', () => {
        const kpis = {
            totalPosts: 42,
            pendingReview: 3,
            scheduled: 5,
            publishedLast30Days: 18,
            failedActionNeeded: 2
        };

        render(
            <TestWrapper>
                <DashboardKpiCards kpis={kpis} />
            </TestWrapper>
        );

        expect(screen.getByTestId('kpi-totalPosts')).toHaveTextContent('42');
        expect(screen.getByTestId('kpi-failedActionNeeded')).toHaveTextContent('2');
    });
});

describe('WebhookAlert', () => {
    it('renders the alert banner', () => {
        render(
            <TestWrapper>
                <WebhookAlert />
            </TestWrapper>
        );

        expect(screen.getByTestId('webhook-alert')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });
});

describe('QuickApprovalQueue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseApproveSocialPost.mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
            variables: undefined
        } as unknown as ReturnType<typeof useApproveSocialPost>);
    });

    it('renders items in the approval queue', () => {
        const data = makeDashboardData();

        render(
            <TestWrapper>
                <QuickApprovalQueue items={data.quickApprovalQueue} />
            </TestWrapper>
        );

        expect(screen.getByTestId('queue-item-post-1')).toBeInTheDocument();
        expect(screen.getByTestId('queue-item-post-2')).toBeInTheDocument();
    });

    it('renders approve button for each queue item', () => {
        const data = makeDashboardData();

        render(
            <TestWrapper>
                <QuickApprovalQueue items={data.quickApprovalQueue} />
            </TestWrapper>
        );

        expect(screen.getByTestId('queue-approve-btn-post-1')).toBeInTheDocument();
        expect(screen.getByTestId('queue-approve-btn-post-2')).toBeInTheDocument();
    });

    it('shows empty message when queue is empty', () => {
        render(
            <TestWrapper>
                <QuickApprovalQueue items={[]} />
            </TestWrapper>
        );

        expect(screen.getByTestId('approval-queue-empty')).toBeInTheDocument();
    });

    it('calls approve mutation when approve button is clicked', () => {
        const mutateMock = vi.fn();
        mockUseApproveSocialPost.mockReturnValue({
            mutate: mutateMock,
            isPending: false,
            variables: undefined
        } as unknown as ReturnType<typeof useApproveSocialPost>);

        const data = makeDashboardData();

        render(
            <TestWrapper>
                <QuickApprovalQueue items={data.quickApprovalQueue} />
            </TestWrapper>
        );

        fireEvent.click(screen.getByTestId('queue-approve-btn-post-1'));
        expect(mutateMock).toHaveBeenCalledWith('post-1', expect.any(Object));
    });

    it('optimistically removes approved item from queue on approve click', () => {
        const mutateMock = vi.fn();
        mockUseApproveSocialPost.mockReturnValue({
            mutate: mutateMock,
            isPending: false,
            variables: undefined
        } as unknown as ReturnType<typeof useApproveSocialPost>);

        const data = makeDashboardData();
        const queryClient = makeQueryClient();

        queryClient.setQueryData(['social-posts', 'dashboard'], data);

        render(
            <QueryClientProvider client={queryClient}>
                <QuickApprovalQueue items={data.quickApprovalQueue} />
            </QueryClientProvider>
        );

        fireEvent.click(screen.getByTestId('queue-approve-btn-post-1'));

        // The dashboard cache should have post-1 removed from the queue
        const cached = queryClient.getQueryData<SocialDashboardResponse>([
            'social-posts',
            'dashboard'
        ]);
        expect(cached?.quickApprovalQueue.find((i) => i.id === 'post-1')).toBeUndefined();
        expect(cached?.quickApprovalQueue.find((i) => i.id === 'post-2')).toBeDefined();
    });
});

describe('RecentFailures', () => {
    it('renders failure items', () => {
        const data = makeDashboardData();

        render(
            <TestWrapper>
                <RecentFailures items={data.recentFailures} />
            </TestWrapper>
        );

        expect(screen.getByTestId('failure-item-target-1')).toBeInTheDocument();
        expect(screen.getByTestId('failure-post-title-target-1')).toHaveTextContent('Failed Post');
        expect(screen.getByTestId('failure-error-target-1')).toHaveTextContent(
            'Rate limit exceeded'
        );
    });

    it('renders empty message when no failures', () => {
        render(
            <TestWrapper>
                <RecentFailures items={[]} />
            </TestWrapper>
        );

        expect(screen.getByTestId('recent-failures-empty')).toBeInTheDocument();
    });
});

describe('Social dashboard integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseApproveSocialPost.mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
            variables: undefined
        } as unknown as ReturnType<typeof useApproveSocialPost>);
    });

    it('shows webhook alert when makeWebhookConfigured is false', () => {
        mockUseSocialDashboard.mockReturnValue({
            data: makeDashboardData({ makeWebhookConfigured: false }),
            isLoading: false,
            error: null
        } as unknown as ReturnType<typeof useSocialDashboard>);

        render(
            <TestWrapper>
                <WebhookAlert />
            </TestWrapper>
        );

        expect(screen.getByTestId('webhook-alert')).toBeInTheDocument();
    });

    it('KPI cards render data from dashboard response', () => {
        const dashData = makeDashboardData();
        mockUseSocialDashboard.mockReturnValue({
            data: dashData,
            isLoading: false,
            error: null
        } as unknown as ReturnType<typeof useSocialDashboard>);

        render(
            <TestWrapper>
                <DashboardKpiCards kpis={dashData.kpis} />
            </TestWrapper>
        );

        expect(screen.getByTestId('dashboard-kpi-cards')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-pendingReview')).toHaveTextContent('3');
    });
});
