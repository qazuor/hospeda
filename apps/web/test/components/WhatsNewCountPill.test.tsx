import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WhatsNewCountPill } from '@/components/shared/whats-new/WhatsNewCountPill.client';
import { useWhatsNew } from '@/hooks/use-whats-new';

vi.mock('@/hooks/use-whats-new', () => ({ useWhatsNew: vi.fn() }));

/**
 * Sets the mocked `useWhatsNew` hook to report a given unseen count.
 */
function mockUnseen(unseenCount: number): void {
    vi.mocked(useWhatsNew).mockReturnValue({
        items: [],
        unseenCount,
        isLoading: false,
        error: null,
        markSeen: vi.fn(),
        markAllSeen: vi.fn()
    } as unknown as ReturnType<typeof useWhatsNew>);
}

describe('WhatsNewCountPill', () => {
    it('renders nothing when there are no unseen entries', () => {
        mockUnseen(0);
        const { container } = render(<WhatsNewCountPill locale="es" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders the unseen count when greater than zero', () => {
        mockUnseen(3);
        render(<WhatsNewCountPill locale="es" />);
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('caps the displayed count at 99+', () => {
        mockUnseen(150);
        render(<WhatsNewCountPill locale="es" />);
        expect(screen.getByText('99+')).toBeInTheDocument();
    });
});
