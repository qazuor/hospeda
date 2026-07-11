/**
 * @file MobileMenu.account.test.tsx
 * @description RTL tests for the curated account block inside the mobile
 * hamburguesa (HOS-131 §6.5 mobile "option A") — same curated set as the
 * avatar dropdown (identity "Mi cuenta" link, Favoritos, ONE business
 * shortcut, Suscripción), gated by permissions resolved via the same
 * `/auth/me` cache-first pattern as `UserMenu.client.tsx`.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileMenu } from '../../../../src/components/shared/navigation/MobileMenu.client';
import { AUTH_ME_CACHE_KEY } from '../../../../src/lib/auth-cache';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../../src/components/shared/navigation/MobileMenu.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../../src/components/shared/feedback/LoadingButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../../src/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../../src/components/shared/preferences/LanguageSwitcher.client', () => ({
    LanguageSwitcher: () => <div data-testid="language-switcher" />
}));

vi.mock('../../../../src/components/shared/preferences/ThemeControl.client', () => ({
    ThemeControl: () => <div data-testid="theme-control" />
}));

vi.mock('../../../../src/components/ui/IconButtonReact', () => ({
    IconButton: ({
        children,
        onClick,
        ariaLabel
    }: {
        children: React.ReactNode;
        onClick?: () => void;
        ariaLabel: string;
    }) => (
        <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel}
        >
            {children}
        </button>
    )
}));

vi.mock('../../../../src/lib/auth-client', () => ({
    signOut: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.test'
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
    locale: 'es' as const,
    navItems: [{ label: 'Inicio', href: '/es/' }],
    currentPath: '/es/',
    logoSrc: '/logo.svg',
    homeHref: '/es/',
    user: {
        name: 'Ana García',
        email: 'ana@example.com'
    }
};

function renderMenu(overrides: Partial<typeof DEFAULT_PROPS> = {}) {
    return render(
        <MobileMenu
            {...DEFAULT_PROPS}
            {...overrides}
        />
    );
}

/** Opens the menu by dispatching the custom toggle event. */
function openMenu() {
    act(() => {
        window.dispatchEvent(new CustomEvent('mobile-menu:toggle'));
    });
}

/** Opens the menu then expands the account submenu. */
function openAccountMenu() {
    openMenu();
    const userRow = screen.getByRole('button', { name: /Ana García/i });
    fireEvent.click(userRow);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MobileMenu — curated account block (HOS-131 §6.5)', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it('shows the identity "Mi cuenta" link, Favoritos, and Suscripción while permissions are loading (no gating)', () => {
        global.fetch = vi.fn(
            () =>
                new Promise(() => {
                    // Never resolves — simulates pending /auth/me
                })
        ) as unknown as typeof fetch;

        renderMenu();
        openAccountMenu();

        expect(screen.getByRole('link', { name: /mi cuenta/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /^favoritos$/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /^suscripción$/i })).toBeInTheDocument();
    });

    it('hides the business shortcut while permissions are loading (fail-closed)', () => {
        global.fetch = vi.fn(
            () =>
                new Promise(() => {
                    // Never resolves
                })
        ) as unknown as typeof fetch;

        renderMenu();
        openAccountMenu();

        expect(
            screen.queryByRole('link', { name: /panel del anfitrión/i })
        ).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /mi comercio/i })).not.toBeInTheDocument();
    });

    it('does NOT show non-curated sidebar-only links (reviews, preferences)', () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: { actor: { id: 'u1', permissions: [] }, isAuthenticated: true }
            })
        }) as unknown as typeof fetch;

        renderMenu();
        openAccountMenu();

        expect(screen.queryByRole('link', { name: /mis reseñas/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /^preferencias$/i })).not.toBeInTheDocument();
    });

    it('shows the "Panel del anfitrión" business shortcut once accommodation.create resolves from the cache', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'u1', name: 'Ana García', email: 'ana@example.com' },
                permissions: ['accommodation.create'],
                cachedAt: Date.now()
            })
        );
        const fetchMock = vi.fn();
        global.fetch = fetchMock as unknown as typeof fetch;

        renderMenu();
        openAccountMenu();

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /panel del anfitrión/i })).toBeInTheDocument();
        });
        expect(screen.queryByRole('link', { name: /mi comercio/i })).not.toBeInTheDocument();
        // Cache was fresh and authenticated — no network round-trip needed.
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shows the "Mi comercio" business shortcut for commerce-only owners', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'u1', name: 'Ana García', email: 'ana@example.com' },
                permissions: ['commerce.editOwn'],
                cachedAt: Date.now()
            })
        );
        global.fetch = vi.fn() as unknown as typeof fetch;

        renderMenu();
        openAccountMenu();

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /mi comercio/i })).toBeInTheDocument();
        });
        expect(
            screen.queryByRole('link', { name: /panel del anfitrión/i })
        ).not.toBeInTheDocument();
    });

    it('prioritizes "Panel del anfitrión" over "Mi comercio" when the user has both permissions', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'u1', name: 'Ana García', email: 'ana@example.com' },
                permissions: ['accommodation.create', 'commerce.editOwn'],
                cachedAt: Date.now()
            })
        );
        global.fetch = vi.fn() as unknown as typeof fetch;

        renderMenu();
        openAccountMenu();

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /panel del anfitrión/i })).toBeInTheDocument();
        });
        expect(screen.queryByRole('link', { name: /mi comercio/i })).not.toBeInTheDocument();
    });

    it('fetches permissions from /auth/me when no cache is present', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    actor: { id: 'u1', permissions: ['accommodation.create'] },
                    isAuthenticated: true
                }
            })
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        renderMenu();
        openAccountMenu();

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /panel del anfitrión/i })).toBeInTheDocument();
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not fetch permissions for a guest (no user prop)', () => {
        const fetchMock = vi.fn();
        global.fetch = fetchMock as unknown as typeof fetch;

        renderMenu({ user: null });
        openMenu();

        expect(fetchMock).not.toHaveBeenCalled();
    });
});
