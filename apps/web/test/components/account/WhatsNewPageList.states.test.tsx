/**
 * @file WhatsNewPageList.states.test.tsx
 * @description The async states of the «Novedades de Hospeda» page body
 * (HOS-2501): kit Skeleton while loading, kit ErrorState with a retry that
 * loads again, and the kit EmptyState.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type HookState = {
    items: readonly {
        id: string;
        title: string;
        body: string;
        publishedAt: string;
        seen: boolean;
    }[];
    isLoading: boolean;
    error: Error | null;
};

let state: HookState = { items: [], isLoading: false, error: null };
const mounts = vi.fn();

vi.mock('@/hooks/use-whats-new', () => ({
    useWhatsNew: () => {
        mounts();
        return { ...state, markSeen: vi.fn() };
    }
}));

import { WhatsNewPageList } from '../../../src/components/account/WhatsNewPageList.client';

describe('WhatsNewPageList async states (HOS-2501)', () => {
    beforeEach(() => {
        state = { items: [], isLoading: false, error: null };
        mounts.mockClear();
    });

    it('shows busy skeleton rows while loading', () => {
        state = { ...state, isLoading: true };
        const { container } = render(<WhatsNewPageList locale="es" />);

        expect(container.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);
        expect(screen.queryByRole('article')).toBeNull();
    });

    it('shows the kit empty state when there are no entries', () => {
        render(<WhatsNewPageList locale="es" />);

        expect(screen.getByText('No hay novedades aún')).toBeInTheDocument();
    });

    it('shows an error state with a retry that loads the entries again', () => {
        state = { ...state, error: new Error('boom') };
        render(<WhatsNewPageList locale="es" />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
        const rendersBefore = mounts.mock.calls.length;

        state = {
            items: [
                { id: 'a', title: 'Entrada A', body: 'x', publishedAt: '2026-01-01', seen: true }
            ],
            isLoading: false,
            error: null
        };
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

        expect(mounts.mock.calls.length).toBeGreaterThan(rendersBefore);
        expect(screen.getByText('Entrada A')).toBeInTheDocument();
    });
});
