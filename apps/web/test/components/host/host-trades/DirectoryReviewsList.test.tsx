/**
 * @file DirectoryReviewsList.test.tsx
 * @description The directory's review list as a host reads it (HOS-376 T-053).
 *
 * The per-row rules are asserted against the pure resolver in
 * `resolve-directory-review-view.test.ts`. What these tests add is what only
 * the rendered island can show: that the server-read page is on screen without
 * a fetch, that paging replaces it, and that a failed page keeps the reviews
 * already being read.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DirectoryReviewRow } from '@/lib/api/endpoints-protected';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockListDirectoryReviews = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    hostTradesApi: {
        listDirectoryReviews: (args: unknown) => mockListDirectoryReviews(args)
    }
}));

vi.mock('@/lib/api-errors', () => ({
    translateApiError: ({ fallback }: { fallback: string }) => fallback
}));

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string, params?: Record<string, string>) => {
            const template = fallback ?? key;
            return Object.entries(params ?? {}).reduce(
                (text, [name, value]) => text.replace(`{{${name}}}`, value),
                template
            );
        },
        tPlural: (_key: string, count: number, params?: Record<string, string>) =>
            `${params?.count ?? count} valoraciones`
    })
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/components/host/host-trades/DirectoryReviews.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

import { DirectoryReviewsList } from '@/components/host/host-trades/DirectoryReviewsList.client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Builds a directory review row.
 *
 * @param overrides - The id, comment, author and reply to apply.
 * @returns A row shaped as the endpoint serves it.
 */
function buildRow(overrides: {
    id: string;
    content?: string | null;
    authorName?: string | null;
    respectedBenefit?: boolean;
    rating?: Record<string, number> | null;
    reply?: { content: string; reviewEditedAfterReply?: boolean } | null;
}): DirectoryReviewRow {
    return {
        review: {
            id: overrides.id,
            hostTradeId: 'trade-1',
            hostUserId: 'user-1',
            overallRating: 4,
            rating: overrides.rating ?? null,
            averageRating: 4,
            respectedBenefit: overrides.respectedBenefit ?? true,
            content: overrides.content ?? null,
            moderationState: 'APPROVED',
            editedAt: null,
            createdAt: '2026-08-01T10:00:00Z',
            updatedAt: '2026-08-01T10:00:00Z'
        },
        author:
            overrides.authorName === null
                ? null
                : { id: 'user-1', displayName: overrides.authorName ?? 'Ana', image: null },
        reply: overrides.reply
            ? {
                  id: `reply-${overrides.id}`,
                  reviewId: overrides.id,
                  content: overrides.reply.content,
                  moderationState: 'APPROVED',
                  reviewEditedAfterReply: overrides.reply.reviewEditedAfterReply ?? false,
                  createdAt: '2026-08-02T10:00:00Z',
                  updatedAt: '2026-08-02T10:00:00Z'
              }
            : null
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DirectoryReviewsList', () => {
    beforeEach(() => {
        mockListDirectoryReviews.mockReset();
    });

    it('should render the server-read page without fetching anything', () => {
        render(
            <DirectoryReviewsList
                hostTradeId="trade-1"
                initialRows={[buildRow({ id: 'r1', content: 'Vino en el día.' })]}
                initialTotal={1}
                initialTotalPages={1}
                locale="es"
            />
        );

        expect(screen.getByText('Vino en el día.')).toBeInTheDocument();
        // The reviews ARE the page: needing a round trip to show them would put
        // an empty panel in front of the host who came to read them.
        expect(mockListDirectoryReviews).not.toHaveBeenCalled();
    });

    it('should show the provider answer the endpoint cleared', () => {
        render(
            <DirectoryReviewsList
                hostTradeId="trade-1"
                initialRows={[buildRow({ id: 'r1', reply: { content: 'Perdón por la demora.' } })]}
                initialTotal={1}
                initialTotalPages={1}
                locale="es"
            />
        );

        expect(screen.getByText('Perdón por la demora.')).toBeInTheDocument();
    });

    it('should never render an answer the endpoint withheld', () => {
        // A PENDING or REJECTED answer does not travel: the row arrives with
        // `reply: null`, indistinguishable from one never written. The page
        // must not invent a placeholder that would let a reader deduce a
        // provider said something a moderator took down.
        const { container } = render(
            <DirectoryReviewsList
                hostTradeId="trade-1"
                initialRows={[buildRow({ id: 'r1', content: 'Puntual.' })]}
                initialTotal={1}
                initialTotalPages={1}
                locale="es"
            />
        );

        expect(container.querySelector('.replyBlock')).toBeNull();
        expect(screen.queryByText(/Respuesta del proveedor/)).not.toBeInTheDocument();
    });

    it('should warn when the review changed after the answer', () => {
        render(
            <DirectoryReviewsList
                hostTradeId="trade-1"
                initialRows={[
                    buildRow({
                        id: 'r1',
                        reply: { content: 'Ya lo resolvimos.', reviewEditedAfterReply: true }
                    })
                ]}
                initialTotal={1}
                initialTotalPages={1}
                locale="es"
            />
        );

        expect(
            screen.getByText('La valoración fue editada después de esta respuesta.')
        ).toBeInTheDocument();
    });

    it('should show the breakdown a host scored', () => {
        render(
            <DirectoryReviewsList
                hostTradeId="trade-1"
                initialRows={[buildRow({ id: 'r1', rating: { workQuality: 5, punctuality: 3 } })]}
                initialTotal={1}
                initialTotalPages={1}
                locale="es"
            />
        );

        expect(screen.getByText('workQuality')).toBeInTheDocument();
        expect(screen.getByText('punctuality')).toBeInTheDocument();
    });

    it('should say whether the benefit was honoured', () => {
        render(
            <DirectoryReviewsList
                hostTradeId="trade-1"
                initialRows={[buildRow({ id: 'r1', respectedBenefit: false })]}
                initialTotal={1}
                initialTotalPages={1}
                locale="es"
            />
        );

        expect(screen.getByText(/NO respetó el beneficio/)).toBeInTheDocument();
    });

    it('should name an author-less review rather than leave it blank', () => {
        render(
            <DirectoryReviewsList
                hostTradeId="trade-1"
                initialRows={[buildRow({ id: 'r1', authorName: null })]}
                initialTotal={1}
                initialTotalPages={1}
                locale="es"
            />
        );

        expect(screen.getByText('Un anfitrión')).toBeInTheDocument();
    });

    it('should say the read failed rather than claim nobody reviewed the provider', () => {
        // A failed read and an unreviewed provider both arrive as zero rows.
        // Only one of them may be stated as fact about a real person's trade,
        // on the very screen a host uses to decide whether to call them.
        render(
            <DirectoryReviewsList
                hostTradeId="trade-1"
                initialLoadFailed={true}
                initialRows={[]}
                initialTotal={0}
                initialTotalPages={1}
                locale="es"
            />
        );

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.queryByText(/Todavía nadie valoró/)).not.toBeInTheDocument();
    });

    it('should render the empty state instead of an empty list', () => {
        const { container } = render(
            <DirectoryReviewsList
                hostTradeId="trade-1"
                initialRows={[]}
                initialTotal={0}
                initialTotalPages={1}
                locale="es"
            />
        );

        expect(screen.getByText(/Todavía nadie valoró a este proveedor/)).toBeInTheDocument();
        expect(container.querySelector('.list')).toBeNull();
    });

    describe('paging', () => {
        it('should hide the pager when everything fits on one page', () => {
            render(
                <DirectoryReviewsList
                    hostTradeId="trade-1"
                    initialRows={[buildRow({ id: 'r1' })]}
                    initialTotal={1}
                    initialTotalPages={1}
                    locale="es"
                />
            );

            expect(screen.queryByRole('button', { name: 'Siguientes' })).not.toBeInTheDocument();
        });

        it('should replace the list with the page it fetched', async () => {
            mockListDirectoryReviews.mockResolvedValue({
                ok: true,
                data: {
                    items: [buildRow({ id: 'r2', content: 'De la página dos.' })],
                    pagination: { page: 2, pageSize: 10, total: 2, totalPages: 2 }
                }
            });

            render(
                <DirectoryReviewsList
                    hostTradeId="trade-1"
                    initialRows={[buildRow({ id: 'r1', content: 'De la página uno.' })]}
                    initialTotal={2}
                    initialTotalPages={2}
                    locale="es"
                />
            );

            await userEvent.click(screen.getByRole('button', { name: 'Siguientes' }));

            await waitFor(() => {
                expect(screen.getByText('De la página dos.')).toBeInTheDocument();
            });
            expect(screen.queryByText('De la página uno.')).not.toBeInTheDocument();
            expect(mockListDirectoryReviews).toHaveBeenCalledWith({
                hostTradeId: 'trade-1',
                page: 2
            });
        });

        it('should keep the reviews on screen when a page fails to load', async () => {
            mockListDirectoryReviews.mockResolvedValue({
                ok: false,
                error: { status: 500, message: 'boom' }
            });

            render(
                <DirectoryReviewsList
                    hostTradeId="trade-1"
                    initialRows={[buildRow({ id: 'r1', content: 'De la página uno.' })]}
                    initialTotal={2}
                    initialTotalPages={2}
                    locale="es"
                />
            );

            await userEvent.click(screen.getByRole('button', { name: 'Siguientes' }));

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });
            // The failure costs the page he asked for, not the one he was reading.
            expect(screen.getByText('De la página uno.')).toBeInTheDocument();
        });

        it('should not offer a previous page from the first one', () => {
            render(
                <DirectoryReviewsList
                    hostTradeId="trade-1"
                    initialRows={[buildRow({ id: 'r1' })]}
                    initialTotal={2}
                    initialTotalPages={2}
                    locale="es"
                />
            );

            expect(screen.getByRole('button', { name: 'Anteriores' })).toBeDisabled();
        });
    });
});
