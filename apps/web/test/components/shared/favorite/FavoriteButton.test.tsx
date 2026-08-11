/**
 * @file FavoriteButton.test.tsx
 * @description Unit tests for the FavoriteButton React island (SPEC-098 T-058).
 *
 * Coverage:
 * - Guest render: no popover open initially, heart icon visible, aria-pressed=false
 * - Authenticated not-favorited: aria-pressed=false
 * - Authenticated favorited: aria-pressed=true
 * - Guest click: opens AuthRequiredPopover, no API call
 * - Authenticated click: optimistic toggle + API call with correct args
 * - API error (non-401/403): rollback + generic toast
 * - API 401: rollback + popover reopens
 * - API 403 LIMIT_REACHED: rollback + limit-reached toast
 * - isPending state during request: button disabled + aria-busy
 * - Client-side resolution (HOS-369 WB0-3): state comes from the shared
 *   favorites store, not from SSR props
 *   - One bulk request shared by every heart on the page; none at all for a guest
 *   - Busy + disabled while resolving; degrades to un-favorited when it fails
 *   - `initialIsFavorited` / `initialBookmarkId` / `isAuthenticated` were
 *     removed from `FavoriteButtonProps` entirely (HOS-369 WB0-5) — a source
 *     assertion on the interface proves they have not come back, and the
 *     toggle/prompt behavior is shown to come only from the resolved session
 * - Pill variant count badge: visible when count >= 3, hidden when count < 3 or undefined
 * - Locale number formatting: count=1234 with locale='es' → "1.234"
 *
 * Session is controlled through the `auth-cache` mock — the one module both the
 * store and `useAccountPermissions` read — via arrangeGuest / arrangeUser /
 * arrangeFavoritedUser.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FavoriteButtonProps } from '../../../../src/components/shared/favorite/FavoriteButton.client';
import { FavoriteButton } from '../../../../src/components/shared/favorite/FavoriteButton.client';
import { resetFavoritesStore } from '../../../../src/store/favorites-store';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/lib/i18n', () => ({
    createT: (_locale: string) => (key: string, fallback?: string) => fallback ?? key
}));

vi.mock('../../../../src/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('../../../../src/components/shared/favorite/FavoriteButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// Mock AuthRequiredPopover so we can assert on its presence without needing
// its internal CSS and icon dependencies.
vi.mock('../../../../src/components/auth/AuthRequiredPopover.client', () => ({
    AuthRequiredPopover: ({
        onClose
    }: {
        message: string;
        onClose: () => void;
        locale?: string;
        returnUrl?: string;
    }) => (
        // biome-ignore lint/a11y/useSemanticElements: mock element — <dialog> not needed in test DOM
        <div
            role="dialog"
            aria-label="Autenticacion requerida"
            data-testid="auth-required-popover"
        >
            <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
            >
                Cerrar
            </button>
        </div>
    )
}));

vi.mock('@repo/icons', () => ({
    FavoriteIcon: ({
        weight,
        size
    }: {
        weight?: string;
        size?: number;
        'aria-hidden'?: string;
    }) => (
        <svg
            data-testid="favorite-icon"
            data-weight={weight}
            width={size}
            aria-hidden="true"
        />
    )
}));

// Mock the API module — individual tests override specific methods as needed.
const mockToggle = vi.fn();
const mockCheckBulk = vi.fn();
const trackEventSpy = vi.fn();

vi.mock('../../../../src/lib/analytics/posthog-client', () => ({
    trackEvent: (...args: unknown[]) => trackEventSpy(...args)
}));

vi.mock('../../../../src/lib/api/endpoints-protected', () => ({
    userBookmarksApi: {
        toggle: (...args: unknown[]) => mockToggle(...args),
        checkBulk: (...args: unknown[]) => mockCheckBulk(...args)
    }
}));

// The session is resolved client-side (HOS-369 WB0-3) by BOTH the favorites
// store and `useAccountPermissions`, and both read it through `auth-cache`.
// Mocking that one module is therefore the single lever that decides whether a
// test runs as a guest or as a signed-in visitor.
const mockReadCachedAuthMe = vi.fn();

vi.mock('../../../../src/lib/auth-cache', () => ({
    readCachedAuthMe: () => mockReadCachedAuthMe(),
    fetchAuthMe: () => Promise.resolve(mockReadCachedAuthMe()),
    writeCachedAuthMe: () => undefined,
    // `test/setup.ts` calls this in a global afterEach; the mock must provide it.
    resetInFlightAuthMe: () => undefined
}));

// Mock toast store so we can assert addToast calls.
const mockAddToast = vi.fn();

vi.mock('../../../../src/store/toast-store', () => ({
    addToast: (...args: unknown[]) => mockAddToast(...args)
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid props. Overrides merged via spread. */
function buildProps(overrides: Partial<FavoriteButtonProps> = {}): FavoriteButtonProps {
    return {
        entityId: 'entity-uuid-1',
        entityType: 'ACCOMMODATION',
        locale: 'es',
        ...overrides
    };
}

/** Build an `/auth/me` snapshot for a guest or a signed-in visitor. */
function buildAuthSnapshot(isAuthenticated: boolean) {
    return {
        isAuthenticated,
        user: isAuthenticated ? { id: 'user-1', name: 'Ana', email: 'ana@example.com' } : null,
        permissions: [],
        roles: isAuthenticated ? ['USER'] : [],
        cachedAt: Date.now()
    };
}

/**
 * Make the bulk check report every requested entity with the given favorited
 * state. Keyed off the request so tests that override `entityId` work unchanged.
 */
function stubBulkCheck(isBookmarked: boolean): void {
    mockCheckBulk.mockImplementation(({ entityIds }: { entityIds: readonly string[] }) =>
        Promise.resolve({
            ok: true,
            data: {
                checks: Object.fromEntries(
                    entityIds.map((id) => [
                        id,
                        {
                            isBookmarked,
                            bookmarkId: isBookmarked ? 'bookmark-existing-1' : null
                        }
                    ])
                )
            }
        })
    );
}

/** Arrange a guest visitor and return the component props. */
function arrangeGuest(overrides: Partial<FavoriteButtonProps> = {}): FavoriteButtonProps {
    mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot(false));
    stubBulkCheck(false);
    return buildProps(overrides);
}

/** Arrange a signed-in visitor who has NOT favorited the entity. */
function arrangeUser(overrides: Partial<FavoriteButtonProps> = {}): FavoriteButtonProps {
    mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot(true));
    stubBulkCheck(false);
    return buildProps(overrides);
}

/** Arrange a signed-in visitor who HAS already favorited the entity. */
function arrangeFavoritedUser(overrides: Partial<FavoriteButtonProps> = {}): FavoriteButtonProps {
    mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot(true));
    stubBulkCheck(true);
    return buildProps(overrides);
}

/**
 * Render the button and wait until its state has resolved.
 *
 * Since WB0-3 the heart starts in the anonymous, busy state and settles once
 * the store's bulk check (or the guest short-circuit) completes — so every test
 * must reach that point before asserting or clicking.
 *
 * @returns The usual render result, plus the settled `button` element.
 */
async function renderButton(props: FavoriteButtonProps) {
    const view = render(<FavoriteButton {...props} />);
    const button = screen.getByRole('button');
    await waitFor(() => {
        expect(button).not.toHaveAttribute('data-hydrating');
    });
    return { ...view, button };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();

    // The favorites store caches resolved statuses for the whole page load, so
    // without this a status resolved in one test would satisfy the next test's
    // registration and its bulk check would never be issued.
    resetFavoritesStore();

    // Default: toggle succeeds and returns a new bookmarkId.
    mockToggle.mockResolvedValue({
        ok: true,
        data: { toggled: true, bookmark: { id: 'bookmark-new-1' } }
    });

    // Default session/state; every test overrides via arrangeGuest/arrangeUser.
    mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot(false));
    stubBulkCheck(false);
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Render: guest mode
// ---------------------------------------------------------------------------

describe('FavoriteButton — guest render', () => {
    it('renders the heart icon button', async () => {
        // Arrange / Act
        await renderButton(arrangeGuest());

        // Assert — the component now renders two FavoriteIcon elements: the
        // visible "regular" icon and a hidden "fill" icon used for the CSS
        // hover preview effect (icon stack pattern, commit 35b93bca1). Use
        // getAllByTestId and check at least one icon is present.
        expect(screen.getAllByTestId('favorite-icon').length).toBeGreaterThanOrEqual(1);
    });

    it('has aria-pressed=false when not favorited', async () => {
        // Arrange / Act
        await renderButton(arrangeGuest());

        // Assert
        const btn = screen.getByRole('button');
        expect(btn).toHaveAttribute('aria-pressed', 'false');
    });

    it('does not render the auth popover on initial render', async () => {
        // Arrange / Act
        await renderButton(arrangeGuest());

        // Assert
        expect(screen.queryByTestId('auth-required-popover')).not.toBeInTheDocument();
    });

    it('is not disabled on initial render', async () => {
        // Arrange / Act
        await renderButton(arrangeGuest());

        // Assert
        expect(screen.getByRole('button')).not.toBeDisabled();
    });
});

// ---------------------------------------------------------------------------
// 2. Render: authenticated, not favorited
// ---------------------------------------------------------------------------

describe('FavoriteButton — authenticated not favorited', () => {
    it('has aria-pressed=false', async () => {
        // Arrange / Act
        await renderButton(arrangeUser());

        // Assert
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    });

    it('renders heart icon with regular weight', async () => {
        // Arrange / Act
        await renderButton(arrangeUser());

        // Assert — when not favorited the component renders two icons (CSS hover
        // stack, commit 35b93bca1): the first visible icon has weight="regular"
        // and the second hidden icon has weight="fill" for the hover preview.
        const icons = screen.getAllByTestId('favorite-icon');
        expect(icons[0]).toHaveAttribute('data-weight', 'regular');
    });
});

// ---------------------------------------------------------------------------
// 3. Render: authenticated, favorited
// ---------------------------------------------------------------------------

describe('FavoriteButton — authenticated favorited', () => {
    it('has aria-pressed=true', async () => {
        // Arrange / Act
        await renderButton(arrangeFavoritedUser());

        // Assert
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });

    it('renders heart icon with fill weight when favorited', async () => {
        // Arrange / Act
        await renderButton(arrangeFavoritedUser());

        // Assert — when favorited only one icon renders (no hover-preview layer
        // because the button is already in the "filled" state, commit 35b93bca1).
        const icons = screen.getAllByTestId('favorite-icon');
        expect(icons[0]).toHaveAttribute('data-weight', 'fill');
    });
});

// ---------------------------------------------------------------------------
// 4. Guest click → opens popover, no API call
// ---------------------------------------------------------------------------

describe('FavoriteButton — guest click', () => {
    it('opens the AuthRequiredPopover when a guest clicks', async () => {
        // Arrange
        await renderButton(arrangeGuest());
        const btn = screen.getByRole('button');

        // Act
        fireEvent.click(btn);

        // Assert
        expect(screen.getByTestId('auth-required-popover')).toBeInTheDocument();
    });

    it('does NOT call the toggle API when a guest clicks', async () => {
        // Arrange
        await renderButton(arrangeGuest());

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        expect(mockToggle).not.toHaveBeenCalled();
    });

    it('closes the popover when onClose is invoked', async () => {
        // Arrange
        await renderButton(arrangeGuest());
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByTestId('auth-required-popover')).toBeInTheDocument();

        // Act — click the close button inside the mocked popover
        fireEvent.click(screen.getByRole('button', { name: /Cerrar/i }));

        // Assert
        await waitFor(() => {
            expect(screen.queryByTestId('auth-required-popover')).not.toBeInTheDocument();
        });
    });
});

// ---------------------------------------------------------------------------
// 5. Authenticated click → optimistic toggle + API call
// ---------------------------------------------------------------------------

describe('FavoriteButton — authenticated click (success)', () => {
    it('flips aria-pressed optimistically before the API responds', async () => {
        // Arrange — never-resolving promise so we can catch the in-flight state.
        mockToggle.mockImplementation(function () {
            return new Promise(() => undefined);
        });
        await renderButton(arrangeUser());
        const btn = screen.getByRole('button');
        expect(btn).toHaveAttribute('aria-pressed', 'false');

        // Act
        fireEvent.click(btn);

        // Assert — optimistic state flipped immediately
        expect(btn).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls toggle API with correct entityId and entityType', async () => {
        // Arrange
        await renderButton(arrangeUser({ entityId: 'test-entity-42', entityType: 'DESTINATION' }));

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        await waitFor(() => {
            expect(mockToggle).toHaveBeenCalledWith({
                entityId: 'test-entity-42',
                entityType: 'DESTINATION'
            });
        });
    });

    it('keeps aria-pressed=true after successful API response', async () => {
        // Arrange
        mockToggle.mockResolvedValue({
            ok: true,
            data: { toggled: true, bookmark: { id: 'bm-success-1' } }
        });
        await renderButton(arrangeUser());

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        await waitFor(() => {
            expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
        });
    });

    it('calls onChange with optimistic values immediately', async () => {
        // Arrange
        const onChange = vi.fn();
        await renderButton(arrangeUser({ onChange }));

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert — optimistic onChange fired synchronously within click
        expect(onChange).toHaveBeenCalledWith({
            isFavorited: true,
            bookmarkId: null
        });
    });

    it('calls onChange again with confirmed bookmarkId after success', async () => {
        // Arrange
        const onChange = vi.fn();
        mockToggle.mockResolvedValue({
            ok: true,
            data: { toggled: true, bookmark: { id: 'confirmed-bm-1' } }
        });
        await renderButton(arrangeUser({ onChange }));

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert — second call with confirmed bookmarkId
        await waitFor(() => {
            expect(onChange).toHaveBeenLastCalledWith({
                isFavorited: true,
                bookmarkId: 'confirmed-bm-1'
            });
        });
    });
});

// ---------------------------------------------------------------------------
// 6. API error (generic) → rollback + toast
// ---------------------------------------------------------------------------

describe('FavoriteButton — API error (generic rollback)', () => {
    it('rolls back aria-pressed to original value on non-ok response', async () => {
        // Arrange
        mockToggle.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'Server error' }
        });
        await renderButton(arrangeUser());
        const btn = screen.getByRole('button');

        // Act
        fireEvent.click(btn);

        // Assert — optimistic flip happens, then rolls back
        await waitFor(() => {
            expect(btn).toHaveAttribute('aria-pressed', 'false');
        });
    });

    it('calls addToast with error type and generic message', async () => {
        // Arrange
        mockToggle.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'Server error' }
        });
        await renderButton(arrangeUser());

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
        });
    });

    it('rolls back on network/thrown error', async () => {
        // Arrange
        mockToggle.mockRejectedValue(new Error('Network failure'));
        await renderButton(arrangeUser());
        const btn = screen.getByRole('button');

        // Act
        fireEvent.click(btn);

        // Assert
        await waitFor(() => {
            expect(btn).toHaveAttribute('aria-pressed', 'false');
            expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
        });
    });
});

// ---------------------------------------------------------------------------
// 7. API 401 → rollback + reopens popover
// ---------------------------------------------------------------------------

describe('FavoriteButton — API 401 (session expired)', () => {
    it('rolls back aria-pressed and opens auth popover on 401', async () => {
        // Arrange
        mockToggle.mockResolvedValue({
            ok: false,
            error: { status: 401, code: 'UNAUTHORIZED', message: 'Session expired' }
        });
        await renderButton(arrangeUser());
        const btn = screen.getByRole('button');

        // Act
        fireEvent.click(btn);

        // Assert
        await waitFor(() => {
            // aria-pressed rolled back
            expect(btn).toHaveAttribute('aria-pressed', 'false');
            // popover opened
            expect(screen.getByTestId('auth-required-popover')).toBeInTheDocument();
        });
    });

    it('does NOT call addToast on 401', async () => {
        // Arrange
        mockToggle.mockResolvedValue({
            ok: false,
            error: { status: 401, code: 'UNAUTHORIZED', message: 'Session expired' }
        });
        await renderButton(arrangeUser());

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        await waitFor(() =>
            expect(screen.getByTestId('auth-required-popover')).toBeInTheDocument()
        );
        expect(mockAddToast).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// 8. API 403 LIMIT_REACHED → rollback + limit-reached toast
// ---------------------------------------------------------------------------

describe('FavoriteButton — API 403 LIMIT_REACHED', () => {
    it('rolls back aria-pressed on LIMIT_REACHED', async () => {
        // Arrange
        mockToggle.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'LIMIT_REACHED', message: 'Plan limit exceeded' }
        });
        await renderButton(arrangeUser());
        const btn = screen.getByRole('button');

        // Act
        fireEvent.click(btn);

        // Assert
        await waitFor(() => {
            expect(btn).toHaveAttribute('aria-pressed', 'false');
        });
    });

    it('calls addToast with generic limit-reached message when no details provided', async () => {
        // Arrange — error without details: falls back to billing.limit.generic.message
        mockToggle.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'LIMIT_REACHED', message: 'Plan limit exceeded' }
        });
        await renderButton(arrangeUser());

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert — the toast shows the generic fallback message and an upgrade action
        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    message: expect.stringContaining('límite de tu plan'),
                    action: expect.objectContaining({
                        label: expect.any(String),
                        href: expect.stringContaining('suscripcion')
                    })
                })
            );
        });
    });

    it('calls addToast with upgrade action CTA when details.limitKey is provided', async () => {
        // Arrange — error with details.limitKey='max_favorites': the helper looks up
        // billing.limit.max_favorites.* but in tests the i18n mock always returns the
        // fallback string. We verify the important contract: the action href is present.
        mockToggle.mockResolvedValue({
            ok: false,
            error: {
                status: 403,
                code: 'LIMIT_REACHED',
                message: 'Plan limit exceeded',
                details: {
                    limitKey: 'max_favorites',
                    currentCount: 3,
                    maxAllowed: 3,
                    usagePercent: 100,
                    upgradeAudience: 'tourist'
                }
            }
        });
        await renderButton(arrangeUser());

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert — the toast is an error with an upgrade CTA action.
        // The i18n mock returns fallbacks, so we verify shape not exact string.
        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    action: expect.objectContaining({
                        href: expect.stringContaining('suscripcion')
                    })
                })
            );
        });
    });

    it('does NOT open the auth popover on LIMIT_REACHED', async () => {
        // Arrange
        mockToggle.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'LIMIT_REACHED', message: 'Plan limit exceeded' }
        });
        await renderButton(arrangeUser());

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
        expect(screen.queryByTestId('auth-required-popover')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// 9. isPending state during request
// ---------------------------------------------------------------------------

describe('FavoriteButton — isPending state', () => {
    it('disables the button while API request is in-flight', async () => {
        // Arrange — never resolves so button stays pending
        mockToggle.mockImplementation(function () {
            return new Promise(() => undefined);
        });
        await renderButton(arrangeUser());
        const btn = screen.getByRole('button');

        // Act
        fireEvent.click(btn);

        // Assert
        expect(btn).toBeDisabled();
    });

    it('sets aria-busy=true while API request is in-flight', async () => {
        // Arrange
        mockToggle.mockImplementation(function () {
            return new Promise(() => undefined);
        });
        await renderButton(arrangeUser());
        const btn = screen.getByRole('button');

        // Act
        fireEvent.click(btn);

        // Assert
        expect(btn).toHaveAttribute('aria-busy', 'true');
    });

    it('sets data-pending=true while API request is in-flight', async () => {
        // Arrange
        mockToggle.mockImplementation(function () {
            return new Promise(() => undefined);
        });
        await renderButton(arrangeUser());
        const btn = screen.getByRole('button');

        // Act
        fireEvent.click(btn);

        // Assert
        expect(btn).toHaveAttribute('data-pending', 'true');
    });

    it('re-enables the button after API resolves', async () => {
        // Arrange
        await renderButton(arrangeUser());
        const btn = screen.getByRole('button');

        // Act
        fireEvent.click(btn);

        // Assert — button becomes enabled after API resolves
        await waitFor(() => {
            expect(btn).not.toBeDisabled();
        });
    });

    it('ignores double-click while pending', async () => {
        // Arrange — first click is in-flight
        let resolveToggle: (value: unknown) => void = () => undefined;
        mockToggle.mockImplementation(function () {
            return new Promise((resolve) => {
                resolveToggle = resolve;
            });
        });
        await renderButton(arrangeUser());
        const btn = screen.getByRole('button');

        // Act — click twice; button is disabled after first click so second click is blocked
        fireEvent.click(btn);
        // button should be disabled now
        expect(btn).toBeDisabled();
        // Second click on a disabled button does not fire a new toggle
        fireEvent.click(btn);

        // Resolve the first call
        act(() => {
            resolveToggle({
                ok: true,
                data: { toggled: true, bookmark: { id: 'bm-1' } }
            });
        });

        await waitFor(() => expect(btn).not.toBeDisabled());

        // Assert — toggle was called exactly once
        expect(mockToggle).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// 10. Client-side resolution (HOS-369 WB0-3)
// ---------------------------------------------------------------------------

describe('FavoriteButton — client-side resolution (WB0-3)', () => {
    it('resolves the favorited state from the shared bulk check', async () => {
        // Arrange / Act
        const { button } = await renderButton(
            arrangeFavoritedUser({ entityId: 'resolve-entity-1', entityType: 'DESTINATION' })
        );

        // Assert
        expect(mockCheckBulk).toHaveBeenCalledWith({
            entityType: 'DESTINATION',
            entityIds: ['resolve-entity-1']
        });
        expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('issues no favorites request at all for a guest', async () => {
        // Arrange / Act
        await renderButton(arrangeGuest());

        // Assert — a guest has nothing to look up; the heart resolves locally.
        expect(mockCheckBulk).not.toHaveBeenCalled();
    });

    it('shares one bulk request across every heart on the page', async () => {
        // Arrange — three cards, as a listing would render.
        const ids = ['card-1', 'card-2', 'card-3'];
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot(true));
        stubBulkCheck(false);

        // Act
        render(
            <>
                {ids.map((entityId) => (
                    <FavoriteButton
                        key={entityId}
                        {...buildProps({ entityId })}
                    />
                ))}
            </>
        );
        await waitFor(() => {
            expect(screen.getAllByRole('button')[0]).not.toHaveAttribute('data-hydrating');
        });

        // Assert — one request for all three, not one per card.
        expect(mockCheckBulk).toHaveBeenCalledTimes(1);
        expect(mockCheckBulk).toHaveBeenCalledWith({
            entityType: 'ACCOMMODATION',
            entityIds: ids
        });
    });

    it('is busy and disabled while the state is still resolving', async () => {
        // Arrange — a bulk check that never settles.
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot(true));
        mockCheckBulk.mockImplementation(() => new Promise(() => undefined));

        // Act
        render(<FavoriteButton {...buildProps()} />);

        // Assert — toggling from an unknown base would flip the wrong way.
        await waitFor(() => {
            expect(screen.getByRole('button')).toHaveAttribute('data-hydrating', 'true');
        });
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-busy', 'true');
        expect(button).toBeDisabled();
    });

    it('settles un-favorited and clickable when the bulk check fails', async () => {
        // Arrange
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot(true));
        mockCheckBulk.mockRejectedValue(new Error('Network error'));

        // Act
        const { button } = await renderButton(buildProps());

        // Assert — degraded, not stuck: no toast, no busy state, still usable.
        expect(button).not.toBeDisabled();
        expect(button).toHaveAttribute('aria-pressed', 'false');
        expect(button).toHaveAttribute('aria-busy', 'false');
        expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('declares no SSR-seeded favorite or session prop (HOS-369 WB0-5)', () => {
        // Arrange — the props interface, read as source text.
        //
        // This used to be a pair of `@ts-expect-error` assignments whose comment
        // claimed that resurrecting a prop would surface as an unused-directive
        // error at typecheck. It would not: `apps/web/tsconfig.json` lists only
        // `src/**` under `include`, and `vitest.config.ts` does not enable
        // `test.typecheck`, so NOTHING in CI typechecks this file. Verified by
        // mutation (AC-B0-5): re-adding `isAuthenticated?: boolean` to the
        // interface left `pnpm typecheck` at exit 0. A guard whose stated
        // mechanism does not run is worse than no guard, so the check moved to
        // something that executes.
        const source = readFileSync(
            resolve(
                __dirname,
                '../../../../src/components/shared/favorite/FavoriteButton.client.tsx'
            ),
            'utf8'
        );
        const start = source.indexOf('export interface FavoriteButtonProps {');
        expect(start).toBeGreaterThan(-1);
        const propsInterface = source.slice(start, source.indexOf('\n}', start));

        // Assert — an SSR prop is the only way HTML cached for everyone can
        // seed one visitor's state, which is the whole point of WB0-3/WB0-5.
        // Scoped to the interface body on purpose: the file's header comment
        // discusses these very names, and matching prose would flag a clean
        // file (the same both-directions comment bug the session-blind guard
        // documents).
        for (const forbidden of ['initialIsFavorited', 'initialBookmarkId', 'isAuthenticated']) {
            expect(propsInterface).not.toContain(forbidden);
        }
    });

    it('toggles for a signed-in visitor — state comes only from the session, never a prop', async () => {
        // Arrange — a real session is the only thing that can make this happen;
        // there is no SSR flag left to disagree with it.
        const { button } = await renderButton(arrangeUser());

        // Act
        fireEvent.click(button);

        // Assert — toggles instead of showing the sign-in prompt.
        await waitFor(() => {
            expect(mockToggle).toHaveBeenCalledTimes(1);
        });
        expect(screen.queryByTestId('auth-required-popover')).not.toBeInTheDocument();
    });

    it('prompts for auth for a guest — state comes only from the session, never a prop', async () => {
        // Arrange — no real session, and no prop left that could fake one.
        const { button } = await renderButton(arrangeGuest());

        // Act
        fireEvent.click(button);

        // Assert
        expect(screen.getByTestId('auth-required-popover')).toBeInTheDocument();
        expect(mockToggle).not.toHaveBeenCalled();
    });

    it('removes aria-busy and data-hydrating once resolution completes', async () => {
        // Arrange / Act
        const { button } = await renderButton(arrangeUser());

        // Assert
        expect(button).not.toBeDisabled();
        expect(button).toHaveAttribute('aria-busy', 'false');
        expect(button).not.toHaveAttribute('data-hydrating');
    });
});

// ---------------------------------------------------------------------------
// 10b. Success toasts on toggle (AC-01.1, AC-01.2)
// ---------------------------------------------------------------------------

describe('FavoriteButton — success toasts on toggle', () => {
    it('calls addToast with success type and "saved" message when favoriting succeeds', async () => {
        // Arrange
        mockToggle.mockResolvedValue({
            ok: true,
            data: { toggled: true, bookmark: { id: 'bm-success-1' } }
        });
        await renderButton(arrangeUser());

        // Act — toggle from un-favorited to favorited
        fireEvent.click(screen.getByRole('button'));

        // Assert — success toast for "saved"
        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'success',
                    message: 'Guardado en favoritos'
                })
            );
        });
    });

    it('calls addToast with success type and "removed" message when un-favoriting succeeds', async () => {
        // Arrange
        mockToggle.mockResolvedValue({
            ok: true,
            data: { toggled: false, bookmark: null }
        });
        await renderButton(arrangeFavoritedUser());

        // Act — toggle from favorited to un-favorited
        fireEvent.click(screen.getByRole('button'));

        // Assert — success toast for "removed"
        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'success',
                    message: 'Eliminado de favoritos'
                })
            );
        });
    });

    it('does NOT call addToast with success on error response', async () => {
        // Arrange
        mockToggle.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'ERROR', message: 'fail' }
        });
        await renderButton(arrangeUser());

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert — only error toast, no success toast
        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
        });
        expect(mockAddToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });
});

// ---------------------------------------------------------------------------
// 11. Pill variant + count badge
// ---------------------------------------------------------------------------

describe('FavoriteButton — pill variant + count badge', () => {
    it('shows count badge when variant=pill and count >= 3', async () => {
        // Arrange / Act
        await renderButton(arrangeUser({ variant: 'pill', count: 42 }));

        // Assert — the count badge span is in the DOM
        const badge = screen.getByText(/42/);
        expect(badge).toBeInTheDocument();
    });

    it('hides count badge when variant=pill and count < 3', async () => {
        // Arrange / Act
        await renderButton(arrangeUser({ variant: 'pill', count: 2 }));

        // Assert — no badge text for count 2
        expect(screen.queryByText('2')).not.toBeInTheDocument();
    });

    it('hides count badge when variant=pill and count is exactly 3 (boundary — shown)', async () => {
        // Arrange / Act
        await renderButton(arrangeUser({ variant: 'pill', count: 3 }));

        // Assert — count >= 3 means badge is shown
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('hides count badge when variant=pill and count is undefined', async () => {
        // Arrange / Act
        const { container } = await renderButton(
            arrangeUser({ variant: 'pill', count: undefined })
        );

        // Assert — no badge rendered; verified by the absence of the pill class.
        expect(container.querySelector('.countPill')).not.toBeInTheDocument();
    });

    it('does not render count badge for standalone variant without showCount', async () => {
        // Arrange / Act
        const { container } = await renderButton(
            arrangeUser({ variant: 'standalone', count: 100 })
        );

        // Assert — standalone without showCount=true never shows the count pill
        expect(container.querySelector('.countPill')).not.toBeInTheDocument();
    });

    it('shows count badge for standalone variant when showCount=true and count >= 3', async () => {
        // Arrange / Act
        await renderButton(arrangeUser({ variant: 'standalone', count: 42, showCount: true }));

        // Assert — pill renders with showCount=true even on standalone
        expect(screen.getByText(/42/)).toBeInTheDocument();
    });

    it('hides count badge for standalone variant when showCount=true but count < 3', async () => {
        // Arrange / Act
        const { container } = await renderButton(
            arrangeUser({ variant: 'standalone', count: 2, showCount: true })
        );

        // Assert — count < 3 → pill hidden regardless of showCount
        expect(container.querySelector('.countPill')).not.toBeInTheDocument();
    });

    it('sets data-show-count=true on the button when pill is visible', async () => {
        // Arrange / Act
        await renderButton(arrangeUser({ variant: 'standalone', count: 10, showCount: true }));

        // Assert
        expect(screen.getByRole('button')).toHaveAttribute('data-show-count', 'true');
    });

    it('variant=pill still shows count without showCount prop (backwards compat)', async () => {
        // Arrange / Act
        await renderButton(arrangeUser({ variant: 'pill', count: 10 }));

        // Assert — backwards-compatible: pill variant still works without showCount
        expect(screen.getByText(/10/)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// 12. Locale number formatting
// ---------------------------------------------------------------------------

describe('FavoriteButton — locale number formatting', () => {
    it('formats count=1234 with locale=es using Intl.NumberFormat("es")', async () => {
        // Arrange — derive the expected value from the same runtime Intl implementation
        // so the test is portable across environments (Node's ICU data may vary).
        const expected = new Intl.NumberFormat('es').format(1234);

        await renderButton(arrangeUser({ variant: 'pill', count: 1234, locale: 'es' }));

        // Assert — the badge renders the locale-formatted string
        expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it('formats count=5000 with locale=en using Intl.NumberFormat("en")', async () => {
        // Arrange
        const expected = new Intl.NumberFormat('en').format(5000);

        await renderButton(arrangeUser({ variant: 'pill', count: 5000, locale: 'en' }));

        // Assert
        expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it('renders a different formatted string for es vs en locales for the same count', async () => {
        // Arrange — only meaningful when Intl data diverges between the two locales.
        // We just verify the component delegates to the correct locale without
        // hard-coding a specific separator (Node ICU data varies by build).
        const formattedEs = new Intl.NumberFormat('es').format(1234);
        const formattedEn = new Intl.NumberFormat('en').format(1234);

        const { unmount } = await renderButton(
            arrangeUser({ variant: 'pill', count: 1234, locale: 'es' })
        );
        expect(screen.getByText(formattedEs)).toBeInTheDocument();
        unmount();

        await renderButton(arrangeUser({ variant: 'pill', count: 1234, locale: 'en' }));
        expect(screen.getByText(formattedEn)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// 13. PostHog analytics — favorite_toggled
// ---------------------------------------------------------------------------

describe('FavoriteButton — favorite_toggled analytics event', () => {
    beforeEach(() => {
        trackEventSpy.mockClear();
    });

    it('fires favorite_toggled with action="add" when favoriting succeeds', async () => {
        // Arrange
        mockToggle.mockResolvedValue({
            ok: true,
            data: { toggled: true, bookmark: { id: 'bm-success-1' } }
        });
        await renderButton(arrangeUser({ entityId: 'entity-add-1', entityType: 'ACCOMMODATION' }));

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        await waitFor(() => {
            expect(trackEventSpy).toHaveBeenCalledWith('favorite_added', {
                entity_type: 'ACCOMMODATION',
                entity_id: 'entity-add-1',
                assigned_collection: false
            });
        });
    });

    it('fires favorite_toggled with action="remove" when un-favoriting succeeds', async () => {
        // Arrange
        mockToggle.mockResolvedValue({
            ok: true,
            data: { toggled: false, bookmark: null }
        });
        await renderButton(
            arrangeFavoritedUser({ entityId: 'entity-remove-1', entityType: 'DESTINATION' })
        );

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        await waitFor(() => {
            expect(trackEventSpy).toHaveBeenCalledWith('favorite_removed', {
                entity_type: 'DESTINATION',
                entity_id: 'entity-remove-1',
                assigned_collection: false
            });
        });
    });

    it('does NOT fire favorite_toggled on an error response', async () => {
        // Arrange
        mockToggle.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'ERROR', message: 'fail' }
        });
        await renderButton(arrangeUser());

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
        expect(trackEventSpy).not.toHaveBeenCalled();
    });

    it('does NOT fire favorite_toggled for a guest click', async () => {
        // Arrange
        await renderButton(arrangeGuest());

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        expect(trackEventSpy).not.toHaveBeenCalled();
    });
});
