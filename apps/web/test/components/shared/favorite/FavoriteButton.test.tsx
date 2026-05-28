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
 * - Single-check hydration (T-039b): fires checkStatus on mount when initialIsFavorited=undefined
 *   - During check: aria-busy + data-hydrating=true
 *   - On success: state updates
 *   - On error: silently defaults to false
 * - Pill variant count badge: visible when count >= 3, hidden when count < 3 or undefined
 * - Locale number formatting: count=1234 with locale='es' → "1.234"
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoriteButton } from '../../../../src/components/shared/favorite/FavoriteButton.client';
import type { FavoriteButtonProps } from '../../../../src/components/shared/favorite/FavoriteButton.client';

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
const mockCheckStatus = vi.fn();

vi.mock('../../../../src/lib/api/endpoints-protected', () => ({
    userBookmarksApi: {
        toggle: (...args: unknown[]) => mockToggle(...args),
        checkStatus: (...args: unknown[]) => mockCheckStatus(...args)
    }
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
        isAuthenticated: false,
        locale: 'es',
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();

    // Default: toggle succeeds and returns a new bookmarkId.
    mockToggle.mockResolvedValue({
        ok: true,
        data: { toggled: true, bookmark: { id: 'bookmark-new-1' } }
    });

    // Default: checkStatus succeeds and returns not-favorited.
    mockCheckStatus.mockResolvedValue({
        ok: true,
        data: { isFavorited: false, bookmarkId: null }
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Render: guest mode
// ---------------------------------------------------------------------------

describe('FavoriteButton — guest render', () => {
    it('renders the heart icon button', () => {
        // Arrange / Act
        render(
            <FavoriteButton
                {...buildProps({ isAuthenticated: false, initialIsFavorited: false })}
            />
        );

        // Assert
        expect(screen.getByTestId('favorite-icon')).toBeInTheDocument();
    });

    it('has aria-pressed=false when not favorited', () => {
        // Arrange / Act
        render(
            <FavoriteButton
                {...buildProps({ isAuthenticated: false, initialIsFavorited: false })}
            />
        );

        // Assert
        const btn = screen.getByRole('button');
        expect(btn).toHaveAttribute('aria-pressed', 'false');
    });

    it('does not render the auth popover on initial render', () => {
        // Arrange / Act
        render(
            <FavoriteButton
                {...buildProps({ isAuthenticated: false, initialIsFavorited: false })}
            />
        );

        // Assert
        expect(screen.queryByTestId('auth-required-popover')).not.toBeInTheDocument();
    });

    it('is not disabled on initial render', () => {
        // Arrange / Act
        render(
            <FavoriteButton
                {...buildProps({ isAuthenticated: false, initialIsFavorited: false })}
            />
        );

        // Assert
        expect(screen.getByRole('button')).not.toBeDisabled();
    });
});

// ---------------------------------------------------------------------------
// 2. Render: authenticated, not favorited
// ---------------------------------------------------------------------------

describe('FavoriteButton — authenticated not favorited', () => {
    it('has aria-pressed=false', () => {
        // Arrange / Act
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );

        // Assert
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    });

    it('renders heart icon with regular weight', () => {
        // Arrange / Act
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );

        // Assert
        expect(screen.getByTestId('favorite-icon')).toHaveAttribute('data-weight', 'regular');
    });
});

// ---------------------------------------------------------------------------
// 3. Render: authenticated, favorited
// ---------------------------------------------------------------------------

describe('FavoriteButton — authenticated favorited', () => {
    it('has aria-pressed=true', () => {
        // Arrange / Act
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: true })} />
        );

        // Assert
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });

    it('renders heart icon with fill weight when favorited', () => {
        // Arrange / Act
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: true })} />
        );

        // Assert
        expect(screen.getByTestId('favorite-icon')).toHaveAttribute('data-weight', 'fill');
    });
});

// ---------------------------------------------------------------------------
// 4. Guest click → opens popover, no API call
// ---------------------------------------------------------------------------

describe('FavoriteButton — guest click', () => {
    it('opens the AuthRequiredPopover when a guest clicks', () => {
        // Arrange
        render(
            <FavoriteButton
                {...buildProps({ isAuthenticated: false, initialIsFavorited: false })}
            />
        );
        const btn = screen.getByRole('button');

        // Act
        fireEvent.click(btn);

        // Assert
        expect(screen.getByTestId('auth-required-popover')).toBeInTheDocument();
    });

    it('does NOT call the toggle API when a guest clicks', () => {
        // Arrange
        render(
            <FavoriteButton
                {...buildProps({ isAuthenticated: false, initialIsFavorited: false })}
            />
        );

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        expect(mockToggle).not.toHaveBeenCalled();
    });

    it('closes the popover when onClose is invoked', async () => {
        // Arrange
        render(
            <FavoriteButton
                {...buildProps({ isAuthenticated: false, initialIsFavorited: false })}
            />
        );
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
        mockToggle.mockImplementation(() => new Promise(() => undefined));
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );
        const btn = screen.getByRole('button');
        expect(btn).toHaveAttribute('aria-pressed', 'false');

        // Act
        fireEvent.click(btn);

        // Assert — optimistic state flipped immediately
        expect(btn).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls toggle API with correct entityId and entityType', async () => {
        // Arrange
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    entityId: 'test-entity-42',
                    entityType: 'DESTINATION'
                })}
            />
        );

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
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );

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
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    onChange
                })}
            />
        );

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
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    onChange
                })}
            />
        );

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
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );
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
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );

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
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );
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
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );
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
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );

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
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );
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
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );

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
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );

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
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );

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
        mockToggle.mockImplementation(() => new Promise(() => undefined));
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );
        const btn = screen.getByRole('button');

        // Act
        fireEvent.click(btn);

        // Assert
        expect(btn).toBeDisabled();
    });

    it('sets aria-busy=true while API request is in-flight', async () => {
        // Arrange
        mockToggle.mockImplementation(() => new Promise(() => undefined));
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );
        const btn = screen.getByRole('button');

        // Act
        fireEvent.click(btn);

        // Assert
        expect(btn).toHaveAttribute('aria-busy', 'true');
    });

    it('sets data-pending=true while API request is in-flight', async () => {
        // Arrange
        mockToggle.mockImplementation(() => new Promise(() => undefined));
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );
        const btn = screen.getByRole('button');

        // Act
        fireEvent.click(btn);

        // Assert
        expect(btn).toHaveAttribute('data-pending', 'true');
    });

    it('re-enables the button after API resolves', async () => {
        // Arrange
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );
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
        mockToggle.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveToggle = resolve;
                })
        );
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );
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
// 10. Single-check hydration fallback (T-039b)
// ---------------------------------------------------------------------------

describe('FavoriteButton — single-check hydration (T-039b)', () => {
    it('fires checkStatus on mount when initialIsFavorited is undefined and authenticated', async () => {
        // Arrange
        mockCheckStatus.mockResolvedValue({
            ok: true,
            data: { isFavorited: false, bookmarkId: null }
        });
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: undefined,
                    entityId: 'hydrate-entity-1',
                    entityType: 'ACCOMMODATION'
                })}
            />
        );

        // Assert — checkStatus called on mount
        await waitFor(() => {
            expect(mockCheckStatus).toHaveBeenCalledWith({
                entityId: 'hydrate-entity-1',
                entityType: 'ACCOMMODATION'
            });
        });
    });

    it('does NOT fire checkStatus when initialIsFavorited is provided (false)', () => {
        // Arrange
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false
                })}
            />
        );

        // Assert — no check needed when parent pre-hydrated
        expect(mockCheckStatus).not.toHaveBeenCalled();
    });

    it('does NOT fire checkStatus when user is not authenticated', () => {
        // Arrange
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: false,
                    initialIsFavorited: undefined
                })}
            />
        );

        // Assert
        expect(mockCheckStatus).not.toHaveBeenCalled();
    });

    it('sets aria-busy=true and data-hydrating=true during the check', async () => {
        // Arrange — never resolves so we can inspect the hydrating state
        mockCheckStatus.mockImplementation(() => new Promise(() => undefined));
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: undefined
                })}
            />
        );

        // Assert — during hydration the button is busy and has data-hydrating
        const btn = screen.getByRole('button');
        expect(btn).toHaveAttribute('aria-busy', 'true');
        expect(btn).toHaveAttribute('data-hydrating', 'true');
    });

    it('disables the button during the hydration check', async () => {
        // Arrange
        mockCheckStatus.mockImplementation(() => new Promise(() => undefined));
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: undefined
                })}
            />
        );

        // Assert
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('updates aria-pressed to true when checkStatus returns isFavorited=true', async () => {
        // Arrange
        mockCheckStatus.mockResolvedValue({
            ok: true,
            data: { isFavorited: true, bookmarkId: 'bm-from-check-1' }
        });
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: undefined
                })}
            />
        );

        // Assert
        await waitFor(() => {
            expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
        });
    });

    it('calls onChange with result from checkStatus when found', async () => {
        // Arrange
        const onChange = vi.fn();
        mockCheckStatus.mockResolvedValue({
            ok: true,
            data: { isFavorited: true, bookmarkId: 'bm-check-42' }
        });
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: undefined,
                    onChange
                })}
            />
        );

        // Assert
        await waitFor(() => {
            expect(onChange).toHaveBeenCalledWith({
                isFavorited: true,
                bookmarkId: 'bm-check-42'
            });
        });
    });

    it('silently defaults to false when checkStatus returns non-ok', async () => {
        // Arrange
        mockCheckStatus.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'ERROR', message: 'fail' }
        });
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: undefined
                })}
            />
        );

        // Assert — no toast, button not favorited, button re-enabled
        await waitFor(() => {
            expect(screen.getByRole('button')).not.toBeDisabled();
        });
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
        expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('silently defaults to false when checkStatus throws (network error)', async () => {
        // Arrange
        mockCheckStatus.mockRejectedValue(new Error('Network error'));
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: undefined
                })}
            />
        );

        // Assert
        await waitFor(() => {
            expect(screen.getByRole('button')).not.toBeDisabled();
        });
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
        expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('removes aria-busy and data-hydrating after hydration completes', async () => {
        // Arrange
        mockCheckStatus.mockResolvedValue({
            ok: true,
            data: { isFavorited: false, bookmarkId: null }
        });
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: undefined
                })}
            />
        );

        // Assert — after hydration completes, attributes are removed/false
        await waitFor(() => {
            const btn = screen.getByRole('button');
            expect(btn).not.toBeDisabled();
            expect(btn).toHaveAttribute('aria-busy', 'false');
            expect(btn).not.toHaveAttribute('data-hydrating');
        });
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
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );

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
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: true })} />
        );

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
        render(
            <FavoriteButton {...buildProps({ isAuthenticated: true, initialIsFavorited: false })} />
        );

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
    it('shows count badge when variant=pill and count >= 3', () => {
        // Arrange / Act
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    variant: 'pill',
                    count: 42
                })}
            />
        );

        // Assert — the count badge span is in the DOM
        const badge = screen.getByText(/42/);
        expect(badge).toBeInTheDocument();
    });

    it('hides count badge when variant=pill and count < 3', () => {
        // Arrange / Act
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    variant: 'pill',
                    count: 2
                })}
            />
        );

        // Assert — no badge text for count 2
        expect(screen.queryByText('2')).not.toBeInTheDocument();
    });

    it('hides count badge when variant=pill and count is exactly 3 (boundary — shown)', () => {
        // Arrange / Act
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    variant: 'pill',
                    count: 3
                })}
            />
        );

        // Assert — count >= 3 means badge is shown
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('hides count badge when variant=pill and count is undefined', () => {
        // Arrange / Act
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    variant: 'pill',
                    count: undefined
                })}
            />
        );

        // Assert — no badge rendered
        // We verify by checking countPill class is not present
        const { container } = render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    variant: 'pill'
                })}
            />
        );
        expect(container.querySelector('.countPill')).not.toBeInTheDocument();
    });

    it('does not render count badge for standalone variant without showCount', () => {
        // Arrange / Act
        const { container } = render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    variant: 'standalone',
                    count: 100
                })}
            />
        );

        // Assert — standalone without showCount=true never shows the count pill
        expect(container.querySelector('.countPill')).not.toBeInTheDocument();
    });

    it('shows count badge for standalone variant when showCount=true and count >= 3', () => {
        // Arrange / Act
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    variant: 'standalone',
                    count: 42,
                    showCount: true
                })}
            />
        );

        // Assert — pill renders with showCount=true even on standalone
        expect(screen.getByText(/42/)).toBeInTheDocument();
    });

    it('hides count badge for standalone variant when showCount=true but count < 3', () => {
        // Arrange / Act
        const { container } = render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    variant: 'standalone',
                    count: 2,
                    showCount: true
                })}
            />
        );

        // Assert — count < 3 → pill hidden regardless of showCount
        expect(container.querySelector('.countPill')).not.toBeInTheDocument();
    });

    it('sets data-show-count=true on the button when pill is visible', () => {
        // Arrange / Act
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    variant: 'standalone',
                    count: 10,
                    showCount: true
                })}
            />
        );

        // Assert
        expect(screen.getByRole('button')).toHaveAttribute('data-show-count', 'true');
    });

    it('variant=pill still shows count without showCount prop (backwards compat)', () => {
        // Arrange / Act
        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    variant: 'pill',
                    count: 10
                })}
            />
        );

        // Assert — backwards-compatible: pill variant still works without showCount
        expect(screen.getByText(/10/)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// 12. Locale number formatting
// ---------------------------------------------------------------------------

describe('FavoriteButton — locale number formatting', () => {
    it('formats count=1234 with locale=es using Intl.NumberFormat("es")', () => {
        // Arrange — derive the expected value from the same runtime Intl implementation
        // so the test is portable across environments (Node's ICU data may vary).
        const expected = new Intl.NumberFormat('es').format(1234);

        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    variant: 'pill',
                    count: 1234,
                    locale: 'es'
                })}
            />
        );

        // Assert — the badge renders the locale-formatted string
        expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it('formats count=5000 with locale=en using Intl.NumberFormat("en")', () => {
        // Arrange
        const expected = new Intl.NumberFormat('en').format(5000);

        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    variant: 'pill',
                    count: 5000,
                    locale: 'en'
                })}
            />
        );

        // Assert
        expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it('renders a different formatted string for es vs en locales for the same count', () => {
        // Arrange — only meaningful when Intl data diverges between the two locales.
        // We just verify the component delegates to the correct locale without
        // hard-coding a specific separator (Node ICU data varies by build).
        const formattedEs = new Intl.NumberFormat('es').format(1234);
        const formattedEn = new Intl.NumberFormat('en').format(1234);

        const { unmount } = render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    variant: 'pill',
                    count: 1234,
                    locale: 'es'
                })}
            />
        );
        expect(screen.getByText(formattedEs)).toBeInTheDocument();
        unmount();

        render(
            <FavoriteButton
                {...buildProps({
                    isAuthenticated: true,
                    initialIsFavorited: false,
                    variant: 'pill',
                    count: 1234,
                    locale: 'en'
                })}
            />
        );
        expect(screen.getByText(formattedEn)).toBeInTheDocument();
    });
});
