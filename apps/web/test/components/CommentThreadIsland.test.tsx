/**
 * @file CommentThreadIsland.test.tsx
 * @description RTL tests for the CommentThreadIsland React island.
 *
 * Covers:
 * - AC-27: renders APPROVED comments oldest-first (order preserved from props)
 * - Empty state when no comments
 * - AC-29: authenticated user sees the submit form
 * - AC-29: guest user sees the login CTA (no form)
 * - Submit success path (mock fetch) — optimistic append
 * - AC-28: 429 shows dedicated rate-limit message; input is preserved
 * - Network error is shown inline; input is preserved
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type CommentItem,
    CommentThreadIsland
} from '../../src/components/comments/CommentThreadIsland.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../src/lib/env', () => ({
    getApiUrl: () => 'http://localhost:3001'
}));

vi.mock('../../src/components/comments/CommentThreadIsland.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../src/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COMMENT_A: CommentItem = {
    id: 'c1',
    authorName: 'Alice',
    content: 'First comment',
    createdAt: '2026-01-01T10:00:00.000Z'
};

const COMMENT_B: CommentItem = {
    id: 'c2',
    authorName: 'Bob',
    content: 'Second comment',
    createdAt: '2026-01-02T12:00:00.000Z'
};

const BASE_PROPS = {
    entityType: 'POST' as const,
    entityId: 'post-uuid-1',
    locale: 'es' as const,
    isAuthenticated: false,
    signinUrl: '/es/auth/signin/?returnUrl=%2Fes%2Fpublicaciones%2Ftest%2F'
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderIsland(
    overrides: Partial<Parameters<typeof CommentThreadIsland>[0]> = {},
    comments: readonly CommentItem[] = []
) {
    return render(
        <CommentThreadIsland
            {...BASE_PROPS}
            initialComments={comments}
            {...overrides}
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CommentThreadIsland', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    // ── AC-27: list rendering ────────────────────────────────────────────────

    describe('Comment list', () => {
        it('renders the section header', () => {
            renderIsland();
            expect(screen.getByText(/Comentarios/i)).toBeInTheDocument();
        });

        it('renders both comments in order', () => {
            renderIsland({}, [COMMENT_A, COMMENT_B]);
            const items = screen.getAllByRole('listitem');
            expect(items).toHaveLength(2);
            expect(items[0]).toHaveTextContent('First comment');
            expect(items[1]).toHaveTextContent('Second comment');
        });

        it('renders author names', () => {
            renderIsland({}, [COMMENT_A]);
            expect(screen.getByText('Alice')).toBeInTheDocument();
        });

        it('renders a <time> element with the ISO dateTime attribute', () => {
            renderIsland({}, [COMMENT_A]);
            const time = document.querySelector('time');
            expect(time).not.toBeNull();
            expect(time?.getAttribute('dateTime')).toBe(COMMENT_A.createdAt);
        });

        it('shows comment count badge when comments exist', () => {
            renderIsland({}, [COMMENT_A, COMMENT_B]);
            expect(screen.getByText('2')).toBeInTheDocument();
        });
    });

    // ── Empty state ──────────────────────────────────────────────────────────

    describe('Empty state', () => {
        it('shows empty state message when there are no comments', () => {
            renderIsland({}, []);
            expect(screen.getByText('Sé el primero en comentar')).toBeInTheDocument();
        });

        it('does NOT show the list element when empty', () => {
            renderIsland({}, []);
            expect(screen.queryByRole('list')).not.toBeInTheDocument();
        });
    });

    // ── AC-29: authenticated user sees form ──────────────────────────────────

    describe('Authenticated user', () => {
        it('renders the comment textarea', () => {
            renderIsland({ isAuthenticated: true });
            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        it('renders the submit button', () => {
            renderIsland({ isAuthenticated: true });
            expect(screen.getByRole('button', { name: /Comentar/i })).toBeInTheDocument();
        });

        it('does NOT render the login CTA', () => {
            renderIsland({ isAuthenticated: true });
            expect(screen.queryByText(/Iniciá sesión/i)).not.toBeInTheDocument();
        });

        it('submit button is disabled when textarea is empty', () => {
            renderIsland({ isAuthenticated: true });
            expect(screen.getByRole('button', { name: /Comentar/i })).toBeDisabled();
        });

        it('submit button is enabled after typing content', () => {
            renderIsland({ isAuthenticated: true });
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'My new comment' }
            });
            expect(screen.getByRole('button', { name: /Comentar/i })).not.toBeDisabled();
        });
    });

    // ── AC-29: guest sees login CTA ──────────────────────────────────────────

    describe('Guest user', () => {
        it('renders the login CTA link', () => {
            renderIsland({ isAuthenticated: false });
            expect(screen.getByText('Iniciá sesión para comentar')).toBeInTheDocument();
        });

        it('CTA links to the signinUrl', () => {
            renderIsland({ isAuthenticated: false });
            const link = screen.getByRole('link', { name: /Iniciá sesión/i });
            expect(link).toHaveAttribute('href', BASE_PROPS.signinUrl);
        });

        it('does NOT render the comment form', () => {
            renderIsland({ isAuthenticated: false });
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        });
    });

    // ── Submit success (optimistic append) ────────────────────────────────────

    describe('Submit success', () => {
        it('calls the correct POST endpoint', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                status: 201,
                headers: new Headers(),
                json: async () => ({
                    data: {
                        id: 'new-c',
                        content: 'My new comment',
                        createdAt: '2026-06-01T00:00:00.000Z',
                        author: { id: 'u1', displayName: 'Me' }
                    }
                })
            } as Response);

            renderIsland({ isAuthenticated: true });
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'My new comment' }
            });
            fireEvent.click(screen.getByRole('button', { name: /Comentar/i }));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/api/v1/protected/posts/post-uuid-1/comments'),
                    expect.objectContaining({ method: 'POST', credentials: 'include' })
                );
            });
        });

        it('appends the new comment to the list optimistically', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                status: 201,
                headers: new Headers(),
                json: async () => ({
                    data: {
                        id: 'new-c',
                        content: 'My new comment',
                        createdAt: '2026-06-01T00:00:00.000Z',
                        author: { id: 'u1', displayName: 'Me' }
                    }
                })
            } as Response);

            renderIsland({ isAuthenticated: true }, [COMMENT_A]);
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'My new comment' }
            });
            fireEvent.click(screen.getByRole('button', { name: /Comentar/i }));

            await waitFor(() => {
                expect(screen.getByText('My new comment')).toBeInTheDocument();
            });
        });

        it('uses currentUserName as the appended comment author when the API omits it', async () => {
            // The create endpoint does not echo the author, so the island must fall
            // back to the current user's name instead of rendering a blank author.
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                status: 201,
                headers: new Headers(),
                json: async () => ({
                    data: {
                        id: 'new-c',
                        content: 'Mi comentario',
                        createdAt: '2026-06-01T00:00:00.000Z'
                    }
                })
            } as Response);

            renderIsland({ isAuthenticated: true, currentUserName: 'Carla' });
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'Mi comentario' }
            });
            fireEvent.click(screen.getByRole('button', { name: /Comentar/i }));

            await waitFor(() => {
                expect(screen.getByText('Carla')).toBeInTheDocument();
            });
        });

        it('clears the textarea after successful submit', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                status: 201,
                headers: new Headers(),
                json: async () => ({
                    data: {
                        id: 'new-c',
                        content: 'My new comment',
                        createdAt: '2026-06-01T00:00:00.000Z',
                        author: { id: 'u1', displayName: 'Me' }
                    }
                })
            } as Response);

            renderIsland({ isAuthenticated: true });
            const textarea = screen.getByRole('textbox');
            fireEvent.change(textarea, { target: { value: 'My new comment' } });
            fireEvent.click(screen.getByRole('button', { name: /Comentar/i }));

            await waitFor(() => {
                expect((textarea as HTMLTextAreaElement).value).toBe('');
            });
        });
    });

    // ── AC-28: 429 rate-limit ─────────────────────────────────────────────────

    describe('429 rate-limit (AC-28)', () => {
        it('shows the dedicated rate-limit message on 429', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                status: 429,
                headers: new Headers({ 'Retry-After': '30' }),
                json: async () => ({})
            } as Response);

            renderIsland({ isAuthenticated: true });
            const textarea = screen.getByRole('textbox');
            fireEvent.change(textarea, { target: { value: 'Test comment' } });
            fireEvent.click(screen.getByRole('button', { name: /Comentar/i }));

            await waitFor(() => {
                expect(screen.getByText(/Demasiados comentarios/i)).toBeInTheDocument();
            });
        });

        it('preserves the textarea content on 429 (does NOT clear input)', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                status: 429,
                headers: new Headers({ 'Retry-After': '30' }),
                json: async () => ({})
            } as Response);

            renderIsland({ isAuthenticated: true });
            const textarea = screen.getByRole('textbox');
            fireEvent.change(textarea, { target: { value: 'Test comment' } });
            fireEvent.click(screen.getByRole('button', { name: /Comentar/i }));

            await waitFor(() => {
                expect(screen.getByText(/Demasiados comentarios/i)).toBeInTheDocument();
            });

            expect((textarea as HTMLTextAreaElement).value).toBe('Test comment');
        });

        it('appends the Retry-After value to the rate-limit message', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                status: 429,
                headers: new Headers({ 'Retry-After': '45' }),
                json: async () => ({})
            } as Response);

            renderIsland({ isAuthenticated: true });
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'Test comment' }
            });
            fireEvent.click(screen.getByRole('button', { name: /Comentar/i }));

            await waitFor(() => {
                expect(screen.getByText(/45s/)).toBeInTheDocument();
            });
        });
    });

    // ── Network error ─────────────────────────────────────────────────────────

    describe('Network error', () => {
        it('shows an error message when fetch throws', async () => {
            vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

            renderIsland({ isAuthenticated: true });
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'Test comment' }
            });
            fireEvent.click(screen.getByRole('button', { name: /Comentar/i }));

            await waitFor(() => {
                const alert = screen.getByRole('alert');
                expect(alert).toBeInTheDocument();
            });
        });

        it('preserves textarea content on network error', async () => {
            vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

            renderIsland({ isAuthenticated: true });
            const textarea = screen.getByRole('textbox');
            fireEvent.change(textarea, { target: { value: 'Test comment' } });
            fireEvent.click(screen.getByRole('button', { name: /Comentar/i }));

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });

            expect((textarea as HTMLTextAreaElement).value).toBe('Test comment');
        });

        it('shows non-ok response message from API body', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                status: 422,
                headers: new Headers(),
                json: async () => ({
                    error: { message: 'Content too long' }
                })
            } as Response);

            renderIsland({ isAuthenticated: true });
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'Test comment' }
            });
            fireEvent.click(screen.getByRole('button', { name: /Comentar/i }));

            await waitFor(() => {
                expect(screen.getByText('Content too long')).toBeInTheDocument();
            });
        });
    });

    // ── Char counter ──────────────────────────────────────────────────────────

    describe('Character counter', () => {
        it('updates char count as user types', () => {
            renderIsland({ isAuthenticated: true });
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'Hello' }
            });
            expect(screen.getByText('5/2000')).toBeInTheDocument();
        });
    });

    // ── T-014: inline spinner while submitting (SPEC-228) ─────────────────────

    describe('T-014 — inline Spinner while submitting (SPEC-228)', () => {
        it('T-014: submit button is aria-busy with a changing label while submitting', async () => {
            // Arrange: never-resolving fetch so we stay in submitting state
            vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));

            // Act
            renderIsland({ isAuthenticated: true });
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'Comentario de prueba' }
            });
            fireEvent.click(screen.getByRole('button', { name: /Comentar/i }));

            // Assert: the button announces the in-progress state (the inline
            // Spinner is decorative to avoid a double announcement).
            await waitFor(() => {
                const button = screen.getByRole('button', { name: /Enviando/i });
                expect(button).toHaveAttribute('aria-busy', 'true');
            });
        });

        it('T-014: Spinner disappears after successful submit', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                status: 201,
                headers: new Headers(),
                json: async () => ({
                    data: {
                        id: 'new-c',
                        content: 'Comentario de prueba',
                        createdAt: '2026-06-01T00:00:00.000Z',
                        author: { id: 'u1', displayName: 'Me' }
                    }
                })
            } as Response);

            renderIsland({ isAuthenticated: true });
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'Comentario de prueba' }
            });
            fireEvent.click(screen.getByRole('button', { name: /Comentar/i }));

            // Wait for submit to complete
            await waitFor(() => {
                expect(screen.getByText('Comentario de prueba')).toBeInTheDocument();
            });

            // Spinner should be gone
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });
    });
});
