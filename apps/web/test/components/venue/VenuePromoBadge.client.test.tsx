import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VenuePromoBadge } from '../../../src/components/venue/VenuePromoBadge.client';

vi.mock('../../../src/lib/venue/promotion-window', () => ({
    isPromotionWindowActive: vi.fn(() => true)
}));

afterEach(cleanup);

describe('VenuePromoBadge', () => {
    it('applies the active modifier when a promotion window is active', async () => {
        const { container } = render(
            <VenuePromoBadge
                windows={[{ weekdays: [5], startTime: '18:00', endTime: '20:00' }]}
                locale="es"
            />
        );

        expect(screen.getByText('Ahora')).toBeInTheDocument();
        await waitFor(() =>
            expect(container.querySelector('.venue-card__promo-badge--active')).toBeInTheDocument()
        );
    });
});
