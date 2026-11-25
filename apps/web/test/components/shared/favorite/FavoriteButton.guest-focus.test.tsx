/**
 * @file FavoriteButton.guest-focus.test.tsx
 * @description HOS-2536: every guest favorite heart, not only the gallery one,
 * must hand keyboard focus to the sign-in popover, take it back on dismissal,
 * and expose `aria-expanded` / `aria-controls`. Uses the REAL popover.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoriteButton } from '../../../../src/components/shared/favorite/FavoriteButton.client';
import { resetFavoritesStore } from '../../../../src/store/favorites-store';

const guestSnapshot = {
    isAuthenticated: false,
    user: null,
    permissions: [],
    roles: [],
    cachedAt: Date.now()
};

vi.mock('../../../../src/lib/auth-cache', () => ({
    readCachedAuthMe: () => guestSnapshot,
    fetchAuthMe: () => Promise.resolve(guestSnapshot),
    writeCachedAuthMe: () => undefined,
    resetInFlightAuthMe: () => undefined
}));

vi.mock('../../../../src/lib/analytics/umami-client', () => ({ trackEvent: vi.fn() }));
vi.mock('../../../../src/store/toast-store', () => ({ addToast: vi.fn() }));

describe('FavoriteButton guest prompt keyboard access (default behavior)', () => {
    beforeEach(() => {
        resetFavoritesStore();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('moves focus into the popover, wires aria and returns focus to the heart on Escape', async () => {
        const user = userEvent.setup();
        render(
            <FavoriteButton
                entityId="entity-1"
                entityType="ACCOMMODATION"
                locale="es"
            />
        );
        const heart = await screen.findByRole('button', { name: /favorit/i });
        await waitFor(() => expect(heart).toBeEnabled());
        await user.tab();
        expect(heart).toHaveFocus();
        expect(heart).toHaveAttribute('aria-expanded', 'false');

        await user.keyboard('{Enter}');

        const prompt = await screen.findByRole('dialog');
        expect(within(prompt).getAllByRole('button')[0]).toHaveFocus();
        expect(heart).toHaveAttribute('aria-expanded', 'true');
        expect(prompt.id).toBeTruthy();
        expect(heart).toHaveAttribute('aria-controls', prompt.id);

        await user.keyboard('{Escape}');
        expect(prompt).not.toBeInTheDocument();
        expect(heart).toHaveFocus();
        expect(heart).toHaveAttribute('aria-expanded', 'false');
    });

    it('returns focus to the heart when the close button is activated', async () => {
        const user = userEvent.setup();
        render(
            <FavoriteButton
                entityId="entity-1"
                entityType="ACCOMMODATION"
                locale="es"
            />
        );
        const heart = await screen.findByRole('button', { name: /favorit/i });
        await waitFor(() => expect(heart).toBeEnabled());
        await user.click(heart);

        const prompt = await screen.findByRole('dialog');
        const close = within(prompt).getAllByRole('button')[0] as HTMLElement;
        expect(close).toHaveFocus();
        await user.keyboard('{Enter}');

        expect(prompt).not.toBeInTheDocument();
        expect(heart).toHaveFocus();
    });
});
