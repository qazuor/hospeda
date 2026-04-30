// @vitest-environment jsdom
/**
 * Tests for PostTagDeleteDialog component.
 *
 * Covers:
 * - Dialog renders impact count from API (D-011, AC-005-01)
 * - Confirm button calls DELETE mutation (AC-005-02)
 * - Cancel button closes dialog without calling DELETE (AC-005-03)
 *
 * Uses MSW to mock `/api/v1/admin/posts/tags/:id/impact` responses.
 * TanStack Query is wrapped with a fresh QueryClient per test.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../../../../test/mocks/server';
import { PostTagDeleteDialog } from '../PostTagDeleteDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a fresh QueryClient with retries disabled so tests fail fast.
 */
function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    });
}

/**
 * Wraps children in a fresh TanStack Query provider.
 */
function Wrapper({ children }: { readonly children: ReactNode }) {
    const qc = makeQueryClient();
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/**
 * Full base URL must match VITE_API_URL set in test/setup.tsx.
 * MSW (node mode) resolves relative handler paths to http://localhost (port 80),
 * so we must use the absolute URL to match fetchApi requests to port 3001.
 */
const API_BASE = 'http://localhost:3001/api/v1';

/**
 * Default mock impact response factory.
 */
const mockImpactResponse = (count: number) => ({
    success: true,
    data: { count }
});

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const TAG_ID = '00000000-0000-0000-0000-000000000001';
const TAG_NAME = 'Gastronomía';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PostTagDeleteDialog', () => {
    /**
     * AC-005-01: Dialog shows impact count fetched from the API.
     *
     * When the dialog opens, it calls GET /admin/posts/tags/:id/impact and
     * displays the returned count in the confirmation message.
     */
    it('shows the impact count from the API once loaded', async () => {
        // Arrange — override impact handler to return count 7
        server.use(
            http.get(`${API_BASE}/admin/posts/tags/${TAG_ID}/impact`, () => {
                return HttpResponse.json(mockImpactResponse(7));
            })
        );

        const onConfirm = vi.fn();

        // Act
        render(
            <Wrapper>
                <PostTagDeleteDialog
                    postTagId={TAG_ID}
                    postTagName={TAG_NAME}
                    open={true}
                    onOpenChange={vi.fn()}
                    onConfirm={onConfirm}
                    isDeleting={false}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        // Assert — wait for impact count to appear in the message
        await waitFor(() => {
            expect(screen.getByTestId('impact-message')).toHaveTextContent('7 publicaciones');
        });
    });

    /**
     * AC-005-01 variant: "1 publicación" (singular) when count is 1.
     */
    it('uses singular "publicación" when impact count is 1', async () => {
        // Arrange
        server.use(
            http.get(`${API_BASE}/admin/posts/tags/${TAG_ID}/impact`, () => {
                return HttpResponse.json(mockImpactResponse(1));
            })
        );

        // Act
        render(
            <Wrapper>
                <PostTagDeleteDialog
                    postTagId={TAG_ID}
                    postTagName={TAG_NAME}
                    open={true}
                    onOpenChange={vi.fn()}
                    onConfirm={vi.fn()}
                    isDeleting={false}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        // Assert
        await waitFor(() => {
            expect(screen.getByTestId('impact-message')).toHaveTextContent('1 publicación');
        });
    });

    /**
     * AC-005-01 variant: Impact count = 0 (tag not used by any post).
     */
    it('shows 0 publicaciones when the tag is unused', async () => {
        // Arrange
        server.use(
            http.get(`${API_BASE}/admin/posts/tags/${TAG_ID}/impact`, () => {
                return HttpResponse.json(mockImpactResponse(0));
            })
        );

        // Act
        render(
            <Wrapper>
                <PostTagDeleteDialog
                    postTagId={TAG_ID}
                    postTagName={TAG_NAME}
                    open={true}
                    onOpenChange={vi.fn()}
                    onConfirm={vi.fn()}
                    isDeleting={false}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        // Assert
        await waitFor(() => {
            expect(screen.getByTestId('impact-message')).toHaveTextContent('0 publicaciones');
        });
    });

    /**
     * AC-005-02: Clicking confirm calls onConfirm.
     */
    it('calls onConfirm when the user clicks the confirm button', async () => {
        // Arrange
        server.use(
            http.get(`${API_BASE}/admin/posts/tags/${TAG_ID}/impact`, () => {
                return HttpResponse.json(mockImpactResponse(3));
            })
        );

        const onConfirm = vi.fn();
        const user = userEvent.setup();

        render(
            <Wrapper>
                <PostTagDeleteDialog
                    postTagId={TAG_ID}
                    postTagName={TAG_NAME}
                    open={true}
                    onOpenChange={vi.fn()}
                    onConfirm={onConfirm}
                    isDeleting={false}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        // Wait for impact to load so confirm button is enabled
        await waitFor(() => {
            expect(screen.getByTestId('impact-message')).toBeInTheDocument();
        });

        // Act
        await user.click(screen.getByTestId('confirm-button'));

        // Assert
        expect(onConfirm).toHaveBeenCalledOnce();
    });

    /**
     * AC-005-03: Clicking cancel calls onOpenChange(false) and does NOT call onConfirm.
     */
    it('calls onOpenChange(false) and NOT onConfirm when cancel is clicked', async () => {
        // Arrange
        server.use(
            http.get(`${API_BASE}/admin/posts/tags/${TAG_ID}/impact`, () => {
                return HttpResponse.json(mockImpactResponse(5));
            })
        );

        const onConfirm = vi.fn();
        const onOpenChange = vi.fn();
        const user = userEvent.setup();

        render(
            <Wrapper>
                <PostTagDeleteDialog
                    postTagId={TAG_ID}
                    postTagName={TAG_NAME}
                    open={true}
                    onOpenChange={onOpenChange}
                    onConfirm={onConfirm}
                    isDeleting={false}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        // Wait for impact to load
        await waitFor(() => {
            expect(screen.getByTestId('impact-message')).toBeInTheDocument();
        });

        // Act — click cancel
        await user.click(screen.getByTestId('cancel-button'));

        // Assert — confirm was NOT called
        expect(onConfirm).not.toHaveBeenCalled();
        // onOpenChange was called with false (Radix triggers it on cancel)
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    /**
     * Confirm button is disabled while isDeleting is true.
     */
    it('disables the confirm button when isDeleting is true', async () => {
        // Arrange
        server.use(
            http.get(`${API_BASE}/admin/posts/tags/${TAG_ID}/impact`, () => {
                return HttpResponse.json(mockImpactResponse(2));
            })
        );

        render(
            <Wrapper>
                <PostTagDeleteDialog
                    postTagId={TAG_ID}
                    postTagName={TAG_NAME}
                    open={true}
                    onOpenChange={vi.fn()}
                    onConfirm={vi.fn()}
                    isDeleting={true}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('confirm-button')).toBeDisabled();
        });
    });

    /**
     * Cancel button is disabled while isDeleting is true (prevents escape during mutation).
     */
    it('disables the cancel button when isDeleting is true', async () => {
        // Arrange
        server.use(
            http.get(`${API_BASE}/admin/posts/tags/${TAG_ID}/impact`, () => {
                return HttpResponse.json(mockImpactResponse(0));
            })
        );

        render(
            <Wrapper>
                <PostTagDeleteDialog
                    postTagId={TAG_ID}
                    postTagName={TAG_NAME}
                    open={true}
                    onOpenChange={vi.fn()}
                    onConfirm={vi.fn()}
                    isDeleting={true}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('cancel-button')).toBeDisabled();
        });
    });

    /**
     * Tag name appears in the dialog message.
     */
    it('displays the tag name in the confirmation message', async () => {
        // Arrange
        server.use(
            http.get(`${API_BASE}/admin/posts/tags/${TAG_ID}/impact`, () => {
                return HttpResponse.json(mockImpactResponse(0));
            })
        );

        render(
            <Wrapper>
                <PostTagDeleteDialog
                    postTagId={TAG_ID}
                    postTagName="Trekking"
                    open={true}
                    onOpenChange={vi.fn()}
                    onConfirm={vi.fn()}
                    isDeleting={false}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('impact-message')).toHaveTextContent('Trekking');
        });
    });
});
