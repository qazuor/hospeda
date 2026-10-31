/**
 * @file FavoriteButton.pending.test.tsx
 * @description Regression tests for HOS-1925: a favorite tapped before sign-in
 * is applied once, after authentication, without a second click.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoriteButton } from '../../../../src/components/shared/favorite/FavoriteButton.client';
import {
    PENDING_ACTION_STORAGE_KEY,
    PENDING_ACTION_TTL_MS
} from '../../../../src/lib/pending-action';
import { resetFavoritesStore } from '../../../../src/store/favorites-store';

vi.mock('../../../../src/lib/i18n', () => ({
    createT: (_locale: string) => (key: string, fallback?: string) => fallback ?? key
}));
vi.mock('../../../../src/lib/cn', () => ({
    cn: (...c: (string | undefined | false | null)[]) => c.filter(Boolean).join(' ')
}));
vi.mock('../../../../src/components/shared/favorite/FavoriteButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));
vi.mock('../../../../src/components/auth/AuthRequiredPopover.client', () => ({
    AuthRequiredPopover: () => <div data-testid="auth-required-popover" />
}));
vi.mock('@repo/icons', () => ({ FavoriteIcon: () => <svg aria-hidden="true" /> }));
vi.mock('../../../../src/lib/analytics/posthog-client', () => ({ trackEvent: vi.fn() }));
vi.mock('../../../../src/components/shared/favorite/user-collections-cache', () => ({
    getUserCollections: () => Promise.resolve([])
}));

const mockToggle = vi.fn();
const mockCheckBulk = vi.fn();
vi.mock('../../../../src/lib/api/endpoints-protected', () => ({
    userBookmarksApi: {
        toggle: (...a: unknown[]) => mockToggle(...a),
        checkBulk: (...a: unknown[]) => mockCheckBulk(...a)
    }
}));

const mockReadCachedAuthMe = vi.fn();
vi.mock('../../../../src/lib/auth-cache', () => ({
    readCachedAuthMe: () => mockReadCachedAuthMe(),
    fetchAuthMe: () => Promise.resolve(mockReadCachedAuthMe()),
    writeCachedAuthMe: () => undefined,
    resetInFlightAuthMe: () => undefined
}));
vi.mock('../../../../src/store/toast-store', () => ({ addToast: vi.fn() }));

const ENTITY = 'entity-uuid-1';

function setSession(isAuthenticated: boolean): void {
    mockReadCachedAuthMe.mockReturnValue({
        isAuthenticated,
        user: isAuthenticated ? { id: 'u1', name: 'Ana', email: 'a@b.c' } : null,
        permissions: [],
        roles: isAuthenticated ? ['USER'] : [],
        cachedAt: Date.now()
    });
}

function stubCheck(isBookmarked: boolean): void {
    mockCheckBulk.mockImplementation(({ entityIds }: { entityIds: readonly string[] }) =>
        Promise.resolve({
            ok: true,
            data: {
                checks: Object.fromEntries(
                    entityIds.map((id) => [
                        id,
                        { isBookmarked, bookmarkId: isBookmarked ? 'bm-existing' : null }
                    ])
                )
            }
        })
    );
}

async function mountSettled() {
    const view = render(
        <FavoriteButton
            entityId={ENTITY}
            entityType="ACCOMMODATION"
            locale="es"
        />
    );
    const button = screen.getByRole('button');
    await waitFor(() => expect(button).not.toHaveAttribute('data-hydrating'));
    return { ...view, button };
}

describe('FavoriteButton — favorite tapped before sign-in (HOS-1925)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetFavoritesStore();
        window.sessionStorage.clear();
        mockToggle.mockResolvedValue({
            ok: true,
            data: { toggled: true, bookmark: { id: 'bm-new' } }
        });
        stubCheck(false);
    });

    it('saves the tap as a guest, then favorites it once after login with no second click', async () => {
        // Arrange: guest taps the heart
        setSession(false);
        const guest = await mountSettled();
        await userEvent.click(guest.button);
        expect(mockToggle).not.toHaveBeenCalled();
        expect(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY)).not.toBeNull();
        guest.unmount();
        resetFavoritesStore();

        // Act: back on the page, now signed in
        setSession(true);
        const user = await mountSettled();

        // Assert: applied without another click, exactly once
        await waitFor(() => expect(mockToggle).toHaveBeenCalledTimes(1));
        expect(mockToggle).toHaveBeenCalledWith({ entityId: ENTITY, entityType: 'ACCOMMODATION' });
        await waitFor(() => expect(user.button).toHaveAttribute('aria-pressed', 'true'));
        expect(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY)).toBeNull();
    });

    it('does not un-favorite an entity the account already had bookmarked', async () => {
        setSession(false);
        const guest = await mountSettled();
        await userEvent.click(guest.button);
        guest.unmount();
        resetFavoritesStore();

        setSession(true);
        stubCheck(true);
        const user = await mountSettled();

        await waitFor(() => expect(user.button).toHaveAttribute('aria-pressed', 'true'));
        expect(mockToggle).not.toHaveBeenCalled();
    });

    it('ignores an expired pending favorite', async () => {
        window.sessionStorage.setItem(
            PENDING_ACTION_STORAGE_KEY,
            JSON.stringify({
                action: { kind: 'favorite', entityType: 'ACCOMMODATION', entityId: ENTITY },
                path: window.location.pathname,
                expiresAt: Date.now() - PENDING_ACTION_TTL_MS
            })
        );
        setSession(true);

        const user = await mountSettled();

        expect(user.button).toHaveAttribute('aria-pressed', 'false');
        expect(mockToggle).not.toHaveBeenCalled();
    });

    it('does not apply a pending favorite to a different entity', async () => {
        window.sessionStorage.setItem(
            PENDING_ACTION_STORAGE_KEY,
            JSON.stringify({
                action: { kind: 'favorite', entityType: 'ACCOMMODATION', entityId: 'other' },
                path: window.location.pathname,
                expiresAt: Date.now() + PENDING_ACTION_TTL_MS
            })
        );
        setSession(true);

        await mountSettled();

        expect(mockToggle).not.toHaveBeenCalled();
    });
});
