/**
 * @file WhatsNewPageList.pagination.test.tsx
 * @description Regression test for HOS-2449: the what's-new page rendered every
 * entry at once (~50 entries, ~20.000px on mobile). It now shows one page of
 * entries and reveals the rest on demand, marking only visible entries as seen.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { markSeen } = vi.hoisted(() => ({ markSeen: vi.fn() }));

const FIXTURE = Array.from({ length: 25 }, (_, i) => ({
    id: `entry-${i + 1}`,
    title: `Entry ${i + 1}`,
    body: 'Body',
    publishedAt: '2026-01-01',
    seen: false,
    audience: 'all'
}));

// Cloned per test in `beforeEach` so no test can leak mutations into another.
let items: typeof FIXTURE = [];

vi.mock('@/hooks/use-whats-new', () => ({
    useWhatsNew: () => ({ items, isLoading: false, markSeen })
}));

import {
    WHATS_NEW_PAGE_SIZE,
    WhatsNewPageList
} from '../../../src/components/account/WhatsNewPageList.client';

describe('WhatsNewPageList pagination (HOS-2449)', () => {
    beforeEach(() => {
        markSeen.mockClear();
        items = FIXTURE.map((entry) => ({ ...entry }));
    });

    it('renders only one page of entries when there are more', () => {
        const { container } = render(<WhatsNewPageList locale="en" />);

        expect(container.querySelectorAll('article')).toHaveLength(WHATS_NEW_PAGE_SIZE);
        expect(screen.getByText('Showing 10 of 25')).toBeInTheDocument();
    });

    it('reveals the next page on demand, in the active locale', () => {
        const { container } = render(<WhatsNewPageList locale="en" />);

        fireEvent.click(screen.getByRole('button', { name: 'Show more updates' }));
        expect(container.querySelectorAll('article')).toHaveLength(20);

        fireEvent.click(screen.getByRole('button', { name: 'Show more updates' }));
        expect(container.querySelectorAll('article')).toHaveLength(25);
        expect(screen.queryByRole('button', { name: 'Show more updates' })).toBeNull();
    });

    it('marks only the visible entries as seen', () => {
        render(<WhatsNewPageList locale="es" />);

        const marked = markSeen.mock.calls.flatMap(([ids]) => ids as string[]);
        expect(marked).toHaveLength(WHATS_NEW_PAGE_SIZE);
        expect(marked).not.toContain('entry-11');
    });

    it('marks the newly revealed entries as seen after "show more"', () => {
        render(<WhatsNewPageList locale="en" />);
        markSeen.mockClear();

        fireEvent.click(screen.getByRole('button', { name: 'Show more updates' }));

        const marked = markSeen.mock.calls.flatMap(([ids]) => ids as string[]);
        expect(marked).toContain('entry-11');
        expect(marked).toContain('entry-20');
        expect(marked).not.toContain('entry-21');
    });

    it('shows no "show more" control when everything fits on one page', () => {
        items = items.slice(0, 5);
        const { container } = render(<WhatsNewPageList locale="es" />);

        expect(container.querySelectorAll('article')).toHaveLength(5);
        expect(screen.queryByRole('button')).toBeNull();
    });
});
