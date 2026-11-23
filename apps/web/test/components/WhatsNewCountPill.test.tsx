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

    describe('labelsParentLink (account header icon link)', () => {
        function renderInLink(count: number, locale: 'es' | 'en' | 'pt' = 'es') {
            mockUnseen(count);
            return render(
                <a
                    href="/es/mi-cuenta/novedades/"
                    aria-label="Qué hay de nuevo"
                >
                    <WhatsNewCountPill
                        locale={locale}
                        labelsParentLink
                    />
                </a>
            );
        }

        it('puts the unseen count into the link accessible name (plural)', () => {
            // Arrange + Act
            renderInLink(3);

            // Assert
            expect(screen.getByRole('link')).toHaveAccessibleName(
                'Qué hay de nuevo, 3 novedades sin leer'
            );
        });

        it('uses the singular form for one unseen entry', () => {
            renderInLink(1, 'en');
            expect(screen.getByRole('link')).toHaveAccessibleName("What's new, 1 unread update");
        });

        it('leaves the link label alone when nothing is unseen', () => {
            renderInLink(0);
            expect(screen.getByRole('link')).toHaveAccessibleName('Qué hay de nuevo');
        });

        it('restores the original label when it unmounts', () => {
            const { rerender } = renderInLink(2, 'pt');
            expect(screen.getByRole('link')).toHaveAccessibleName(
                'O que há de novo, 2 novidades não lidas'
            );
            mockUnseen(0);
            rerender(
                <a
                    href="/es/mi-cuenta/novedades/"
                    aria-label="Qué hay de nuevo"
                >
                    <WhatsNewCountPill
                        locale="pt"
                        labelsParentLink
                    />
                </a>
            );
            expect(screen.getByRole('link')).toHaveAccessibleName('Qué hay de nuevo');
        });

        it('does not touch the parent link without the prop (sidebar)', () => {
            mockUnseen(3);
            render(
                <a
                    href="/es/mi-cuenta/novedades/"
                    aria-label="Qué hay de nuevo"
                >
                    <WhatsNewCountPill locale="es" />
                </a>
            );
            expect(screen.getByRole('link')).toHaveAccessibleName('Qué hay de nuevo');
        });
    });
});
