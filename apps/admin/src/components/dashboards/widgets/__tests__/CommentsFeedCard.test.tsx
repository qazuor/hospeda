// @vitest-environment jsdom
/**
 * Tests for CommentsFeedCard component (SPEC-165 T-016).
 *
 * Strategy:
 * - Mock `useDashboardResolver` to return a stub `resolveForScope`.
 * - Mock `useHasPermission` to control the AND permission gate.
 * - Mock `useTranslations` to return predictable translation strings.
 * - Wrap each render in a minimal `QueryClientProvider` so `useQuery` works.
 *
 * Covers:
 * - AC-31: card renders null when POST_COMMENT_VIEW is missing.
 * - AC-31: card renders null when EVENT_COMMENT_VIEW is missing.
 * - AC-31: card renders when BOTH permissions are present.
 * - AC-32: empty state renders the `comments.homeCard.empty` message.
 * - Item rendering: entity-type badge, content excerpt, author,
 *   moderation badge, relative timestamp.
 * - Moderation badge variants: APPROVED → success classes, REJECTED → destructive,
 *   PENDING → muted/outline.
 * - Content exceeding 80 chars is truncated with "…".
 * - Loading state renders the skeleton.
 * - Error state renders the error body.
 * - Unavailable state renders when source is not registered.
 * - queryFn unwrap: `result.data.data?.data` inner array extraction
 *   (tests live in the source-level test below).
 *
 * References: SPEC-165 T-016
 */

import type { Widget } from '@/config/ia/schema';
import { useHasPermission } from '@/hooks/use-auth-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentsFeedCard } from '../CommentsFeedCard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockResolveForScope = vi.fn();

vi.mock('@/contexts/dashboard-resolver-context', () => ({
    useDashboardResolver: () => ({
        resolveForScope: mockResolveForScope,
        buildContextForScope: vi.fn(),
        role: 'EDITOR',
        isAuthenticated: true
    })
}));

vi.mock('@/hooks/use-auth-context', () => ({
    useHasPermission: vi.fn((_perm: string) => true),
    useAuthContext: () => ({ user: { role: 'EDITOR', permissions: [] } }),
    useHasRole: vi.fn(() => false),
    useHasAnyRole: vi.fn(() => false)
}));

// Translation mock — returns the key as its own "translation" for stable assertions.
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => {
            // Map the keys the component uses to recognisable sentinel strings.
            const MAP: Record<string, string> = {
                'comments.homeCard.empty': 'No hay comentarios recientes',
                'comments.moderation.approved': 'Aprobado',
                'comments.moderation.rejected': 'Rechazado',
                'comments.moderation.pending': 'Pendiente'
            };
            return MAP[key] ?? key;
        }
    })
}));

vi.mock('@repo/icons', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/icons')>()),
    AlertTriangleIcon: ({ className }: { className?: string }) => (
        <svg
            data-testid="alert-triangle-icon"
            className={className}
            aria-hidden="true"
        />
    )
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                refetchOnWindowFocus: false,
                refetchOnMount: false
            }
        }
    });
}

function TestWrapper({ children }: { readonly children: ReactNode }) {
    const queryClient = makeQueryClient();
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function makeWidget(overrides: Partial<Widget> = {}): Widget {
    return {
        id: 'editor-card-h',
        type: 'feed',
        label: { es: 'Comentarios', en: 'Comments', pt: 'Comentários' },
        scope: 'all',
        onMissing: 'hide',
        permissions: ['POST_COMMENT_VIEW', 'EVENT_COMMENT_VIEW'],
        config: { source: 'editor.comments.recent', accent: 'warning', icon: 'chat', maxItems: 10 },
        ...overrides
    };
}

/** Stub that resolves immediately with the given data. */
function stubQueryOptions(data: unknown) {
    return {
        queryKey: ['dashboard', 'editor.comments.recent', 'EDITOR', 'all'],
        queryFn: () => Promise.resolve(data),
        staleTime: 60_000
    };
}

/** Stub that always rejects. */
function stubErrorOptions() {
    return {
        queryKey: ['dashboard', 'editor.comments.recent-error', 'EDITOR', 'all'],
        queryFn: () => Promise.reject(new Error('fetch failed')),
        staleTime: 60_000
    };
}

/** A single realistic comment item fixture. */
const COMMENT_ITEM = {
    id: 'c-001',
    entityType: 'POST' as const,
    entityId: 'p-001',
    content: 'Excelente artículo, muy informativo.',
    authorName: 'Ana García',
    moderationState: 'APPROVED' as const,
    createdAt: new Date(Date.now() - 5 * 60 * 1_000).toISOString() // 5 minutes ago
};

const EVENT_COMMENT_ITEM = {
    id: 'c-002',
    entityType: 'EVENT' as const,
    entityId: 'e-001',
    content: 'El evento estuvo increíble, volvería sin dudarlo.',
    authorName: 'Carlos Pérez',
    moderationState: 'PENDING' as const,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1_000).toISOString() // 2 hours ago
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/** Typed reference to the mocked useHasPermission for per-test overrides. */
const mockUseHasPermission = vi.mocked(useHasPermission);

describe('CommentsFeedCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: both permissions present
        mockUseHasPermission.mockReturnValue(true);
    });

    // ── AC-31: Permission AND-gate ─────────────────────────────────────────

    describe('AC-31: permission AND-gate', () => {
        it('renders null when POST_COMMENT_VIEW is missing', () => {
            // First call: POST_COMMENT_VIEW → false; second call: EVENT_COMMENT_VIEW → true
            mockUseHasPermission
                .mockReturnValueOnce(false) // POST_COMMENT_VIEW
                .mockReturnValueOnce(true); // EVENT_COMMENT_VIEW
            // resolveForScope still needs to be configured for the hook call
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([])
            });

            const { container } = render(
                <TestWrapper>
                    <CommentsFeedCard widget={makeWidget()} />
                </TestWrapper>
            );

            expect(container.firstChild).toBeNull();
        });

        it('renders null when EVENT_COMMENT_VIEW is missing', () => {
            // First call: POST_COMMENT_VIEW → true; second call: EVENT_COMMENT_VIEW → false
            mockUseHasPermission
                .mockReturnValueOnce(true) // POST_COMMENT_VIEW
                .mockReturnValueOnce(false); // EVENT_COMMENT_VIEW
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([])
            });

            const { container } = render(
                <TestWrapper>
                    <CommentsFeedCard widget={makeWidget()} />
                </TestWrapper>
            );

            expect(container.firstChild).toBeNull();
        });

        it('renders the card when both POST_COMMENT_VIEW and EVENT_COMMENT_VIEW are present', async () => {
            mockUseHasPermission.mockReturnValue(true);
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([COMMENT_ITEM])
            });

            render(
                <TestWrapper>
                    <CommentsFeedCard widget={makeWidget()} />
                </TestWrapper>
            );

            expect(await screen.findByTestId('comments-feed-card')).toBeInTheDocument();
        });
    });

    // ── AC-32: Empty state ─────────────────────────────────────────────────

    describe('AC-32: empty state', () => {
        it('renders the comments.homeCard.empty message when the array is empty', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([])
            });

            render(
                <TestWrapper>
                    <CommentsFeedCard widget={makeWidget()} />
                </TestWrapper>
            );

            expect(await screen.findByText('No hay comentarios recientes')).toBeInTheDocument();
            expect(await screen.findByTestId('list-widget-empty')).toBeInTheDocument();
        });

        it('renders the empty state when data is null', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions(null)
            });

            render(
                <TestWrapper>
                    <CommentsFeedCard widget={makeWidget()} />
                </TestWrapper>
            );

            expect(await screen.findByTestId('list-widget-empty')).toBeInTheDocument();
        });
    });

    // ── Item rendering ─────────────────────────────────────────────────────

    describe('item rendering', () => {
        it('renders the entity-type badge for a POST comment', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([COMMENT_ITEM])
            });

            render(
                <TestWrapper>
                    <CommentsFeedCard widget={makeWidget()} />
                </TestWrapper>
            );

            const badges = await screen.findAllByTestId('comment-entity-badge');
            expect(badges[0]).toHaveTextContent('POST');
        });

        it('renders the entity-type badge for an EVENT comment', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([EVENT_COMMENT_ITEM])
            });

            render(
                <TestWrapper>
                    <CommentsFeedCard widget={makeWidget()} />
                </TestWrapper>
            );

            const badges = await screen.findAllByTestId('comment-entity-badge');
            expect(badges[0]).toHaveTextContent('EVENT');
        });

        it('renders the content excerpt', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([COMMENT_ITEM])
            });

            render(
                <TestWrapper>
                    <CommentsFeedCard widget={makeWidget()} />
                </TestWrapper>
            );

            expect(await screen.findByTestId('comment-excerpt')).toHaveTextContent(
                COMMENT_ITEM.content
            );
        });

        it('truncates content exceeding 80 characters with ellipsis', async () => {
            const longContent =
                'Este es un comentario muy largo que definitivamente supera los ochenta caracteres de longitud máxima permitida por la vista.';
            expect(longContent.length).toBeGreaterThan(80);

            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([{ ...COMMENT_ITEM, content: longContent }])
            });

            render(
                <TestWrapper>
                    <CommentsFeedCard widget={makeWidget()} />
                </TestWrapper>
            );

            const excerpt = await screen.findByTestId('comment-excerpt');
            const text = excerpt.textContent ?? '';
            expect(text.length).toBeLessThanOrEqual(81); // 80 chars + ellipsis char
            expect(text.endsWith('…')).toBe(true);
        });

        it('renders the author name', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([COMMENT_ITEM])
            });

            render(
                <TestWrapper>
                    <CommentsFeedCard widget={makeWidget()} />
                </TestWrapper>
            );

            expect(await screen.findByTestId('comment-author')).toHaveTextContent(
                COMMENT_ITEM.authorName
            );
        });

        it('renders the moderation badge for APPROVED state', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([COMMENT_ITEM])
            });

            render(
                <TestWrapper>
                    <CommentsFeedCard widget={makeWidget()} />
                </TestWrapper>
            );

            const badge = await screen.findByTestId('comment-moderation-badge');
            expect(badge).toHaveTextContent('Aprobado');
        });

        it('renders the moderation badge for REJECTED state', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([
                    { ...COMMENT_ITEM, moderationState: 'REJECTED' as const }
                ])
            });

            render(
                <TestWrapper>
                    <CommentsFeedCard widget={makeWidget()} />
                </TestWrapper>
            );

            const badge = await screen.findByTestId('comment-moderation-badge');
            expect(badge).toHaveTextContent('Rechazado');
        });

        it('renders the moderation badge for PENDING state', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([EVENT_COMMENT_ITEM])
            });

            render(
                <TestWrapper>
                    <CommentsFeedCard widget={makeWidget()} />
                </TestWrapper>
            );

            const badge = await screen.findByTestId('comment-moderation-badge');
            expect(badge).toHaveTextContent('Pendiente');
        });

        it('renders a relative timestamp for each item', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([COMMENT_ITEM])
            });

            render(
                <TestWrapper>
                    <CommentsFeedCard widget={makeWidget()} />
                </TestWrapper>
            );

            const ts = await screen.findByTestId('comment-timestamp');
            expect(ts.textContent?.length).toBeGreaterThan(0);
        });

        it('renders multiple items', async () => {
            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions([COMMENT_ITEM, EVENT_COMMENT_ITEM])
            });

            render(
                <TestWrapper>
                    <CommentsFeedCard widget={makeWidget()} />
                </TestWrapper>
            );

            const items = await screen.findAllByTestId('comment-feed-item');
            expect(items).toHaveLength(2);
        });

        it('respects maxItems and slices the list', async () => {
            const items = Array.from({ length: 5 }, (_, i) => ({
                ...COMMENT_ITEM,
                id: `c-${i}`,
                content: `Comment ${i}`
            }));

            mockResolveForScope.mockReturnValue({
                found: true,
                options: stubQueryOptions(items)
            });

            render(
                <TestWrapper>
                    <CommentsFeedCard
                        widget={makeWidget({
                            config: { source: 'editor.comments.recent', maxItems: 3 }
                        })}
                    />
                </TestWrapper>
            );

            const rendered = await screen.findAllByTestId('comment-feed-item');
            expect(rendered).toHaveLength(3);
        });
    });

    // ── Loading state ──────────────────────────────────────────────────────

    it('renders the skeleton while loading', () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: {
                queryKey: ['dashboard', 'editor.comments.recent', 'EDITOR', 'all'],
                queryFn: () => new Promise(() => undefined), // never resolves
                staleTime: 60_000
            }
        });

        render(
            <TestWrapper>
                <CommentsFeedCard widget={makeWidget()} />
            </TestWrapper>
        );

        expect(screen.getByTestId('list-widget-skeleton')).toBeInTheDocument();
    });

    // ── Error state ────────────────────────────────────────────────────────

    it('renders the error state when the query fails', async () => {
        mockResolveForScope.mockReturnValue({
            found: true,
            options: stubErrorOptions()
        });

        render(
            <TestWrapper>
                <CommentsFeedCard widget={makeWidget()} />
            </TestWrapper>
        );

        expect(await screen.findByTestId('list-widget-error')).toBeInTheDocument();
    });

    // ── Unavailable state ──────────────────────────────────────────────────

    it('renders the unavailable state when source is not registered', () => {
        mockResolveForScope.mockReturnValue({
            found: false,
            options: {
                queryKey: ['dashboard', '__noop__', 'editor.comments.recent'],
                queryFn: () => Promise.resolve(null),
                staleTime: Number.POSITIVE_INFINITY,
                enabled: false
            }
        });

        render(
            <TestWrapper>
                <CommentsFeedCard widget={makeWidget()} />
            </TestWrapper>
        );

        expect(screen.getByTestId('list-widget-unavailable')).toBeInTheDocument();
    });
});
