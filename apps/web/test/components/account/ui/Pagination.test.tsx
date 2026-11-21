/**
 * Tests for Pagination and its range helper (HOS-2413 T-014).
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { buildPageRange, Pagination } from '../../../../src/components/account/ui';

describe('buildPageRange', () => {
    it.each([
        [{ page: 1, pageCount: 0 }, []],
        [{ page: 1, pageCount: 1 }, [1]],
        [{ page: 1, pageCount: 2 }, [1, 2]],
        [{ page: 2, pageCount: 3 }, [1, 2, 3]],
        [{ page: 1, pageCount: 10 }, [1, 2, 'ellipsis', 10]],
        [{ page: 10, pageCount: 10 }, [1, 'ellipsis', 9, 10]],
        [{ page: 5, pageCount: 10 }, [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]],
        [{ page: 3, pageCount: 10 }, [1, 2, 3, 4, 'ellipsis', 10]],
        [{ page: 4, pageCount: 10 }, [1, 2, 3, 4, 5, 'ellipsis', 10]],
        [{ page: 50, pageCount: 100 }, [1, 'ellipsis', 49, 50, 51, 'ellipsis', 100]],
        [{ page: 99, pageCount: 3 }, [1, 2, 3]]
    ] as const)('%j', (input, expected) => {
        expect(buildPageRange(input)).toEqual(expected);
    });
});

describe('Pagination', () => {
    it('renders links with hrefFor and marks the current page', () => {
        render(
            <Pagination
                page={2}
                pageCount={5}
                locale="es"
                hrefFor={(p) => `/lista?page=${p}`}
            />
        );
        expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeInTheDocument();
        const current = screen.getByRole('link', { name: 'Página 2' });
        expect(current).toHaveAttribute('aria-current', 'page');
        expect(current).toHaveAttribute('href', '/lista?page=2');
        expect(screen.getByRole('link', { name: 'Página siguiente' })).toHaveAttribute(
            'href',
            '/lista?page=3'
        );
    });

    it('renders buttons with onPageChange and calls it', async () => {
        const user = userEvent.setup();
        const onPageChange = vi.fn();
        render(
            <Pagination
                page={2}
                pageCount={5}
                locale="es"
                onPageChange={onPageChange}
            />
        );
        await user.click(screen.getByRole('button', { name: 'Página 4' }));
        expect(onPageChange).toHaveBeenCalledWith(4);
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('disables the arrows at the bounds, for links and buttons', () => {
        const { rerender } = render(
            <Pagination
                page={1}
                pageCount={3}
                locale="es"
                onPageChange={() => {}}
            />
        );
        expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
        rerender(
            <Pagination
                page={3}
                pageCount={3}
                locale="es"
                hrefFor={(p) => `/x/${p}`}
            />
        );
        expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
        expect(screen.queryByRole('link', { name: 'Página siguiente' })).toBeNull();
    });

    it('prevNext shows only the two arrows', () => {
        render(
            <Pagination
                variant="prevNext"
                page={2}
                pageCount={5}
                locale="en"
                onPageChange={() => {}}
            />
        );
        expect(screen.getAllByRole('button')).toHaveLength(2);
        expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument();
    });

    it('loadMore announces the added count and moves focus to the first new item', async () => {
        // Arrange
        const user = userEvent.setup();
        const focusFirstNew = vi.fn();
        const onLoadMore = vi.fn().mockResolvedValue({ addedCount: 12, focusFirstNew });
        render(
            <Pagination
                variant="loadMore"
                locale="es"
                onLoadMore={onLoadMore}
            />
        );
        // Act
        await user.click(screen.getByRole('button', { name: 'Ver más' }));
        // Assert
        await waitFor(() =>
            expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent(
                'Se cargaron 12 más'
            )
        );
        expect(focusFirstNew).toHaveBeenCalledTimes(1);
    });

    it('loadMore hides the button when nothing is left', () => {
        render(
            <Pagination
                variant="loadMore"
                locale="es"
                hasMore={false}
                onLoadMore={async () => undefined}
            />
        );
        expect(screen.queryByRole('button')).toBeNull();
    });
});
