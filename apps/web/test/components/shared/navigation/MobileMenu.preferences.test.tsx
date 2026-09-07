/**
 * @file MobileMenu.preferences.test.tsx
 * @description RTL tests for HOS-312 — the mobile menu's language/theme
 * selectors are guest-only. A signed-in visitor's preferences live on their
 * profile now, not as loose toggles in the menu.
 *
 * Covers:
 * - Guest (resolved, `permissions !== null`): selectors render.
 * - Signed-in user (resolved): selectors do NOT render.
 * - Indeterminate state (auth resolution still pending, `permissions === null`):
 *   selectors do NOT render — fail-closed, since `initialUser: null` here
 *   could be a real guest OR a signed-in visitor on a page whose middleware
 *   didn't parse the session.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
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
    signOut: vi.fn().mockResolvedValue(undefined),
    useSession: vi.fn(() => ({ data: null, isPending: true }))
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
    initialUser: {
        id: 'u1',
        name: 'Ana García',
        email: 'ana@example.com'
    },
    initialRoles: [] as readonly string[]
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MobileMenu — preference selectors are guest-only (HOS-312)', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it('renders the language and theme selectors for a resolved guest', () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: false,
                user: null,
                permissions: [],
                roles: [],
                cachedAt: Date.now()
            })
        );
        global.fetch = vi.fn() as unknown as typeof fetch;

        renderMenu({ initialUser: null });
        openMenu();

        expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
        expect(screen.getByTestId('theme-control')).toBeInTheDocument();
    });

    it('does NOT render the selectors for a resolved signed-in user', () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: DEFAULT_PROPS.initialUser,
                permissions: [],
                roles: [],
                cachedAt: Date.now()
            })
        );
        global.fetch = vi.fn() as unknown as typeof fetch;

        renderMenu();
        openMenu();

        expect(screen.queryByTestId('language-switcher')).not.toBeInTheDocument();
        expect(screen.queryByTestId('theme-control')).not.toBeInTheDocument();
    });

    it('does NOT render the selectors while auth resolution is still pending (fail-closed)', async () => {
        // No cache present, and /auth/me never resolves — this is exactly the
        // indeterminate window where `initialUser: null` could be a real
        // guest or a signed-in visitor on an unparsed page.
        global.fetch = vi.fn(
            () =>
                new Promise(() => {
                    // Never resolves
                })
        ) as unknown as typeof fetch;

        renderMenu({ initialUser: null });
        openMenu();

        expect(screen.queryByTestId('language-switcher')).not.toBeInTheDocument();
        expect(screen.queryByTestId('theme-control')).not.toBeInTheDocument();

        // Give any pending microtasks a chance to flush — still must stay hidden.
        await waitFor(() => {
            expect(screen.queryByTestId('language-switcher')).not.toBeInTheDocument();
        });
    });

    it('shows the selectors once a pending guest visitor resolves via /auth/me', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { actor: null, isAuthenticated: false } })
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        renderMenu({ initialUser: null });
        openMenu();

        expect(screen.queryByTestId('language-switcher')).not.toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
        });
        expect(screen.getByTestId('theme-control')).toBeInTheDocument();
    });

    it('hides the selectors once a pending signed-in visitor resolves via /auth/me on an unparsed page', async () => {
        // initialUser: null (middleware didn't parse the session on this
        // page), but /auth/me reveals the visitor IS signed in.
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    actor: {
                        id: 'u1',
                        name: 'Ana García',
                        email: 'ana@example.com',
                        permissions: []
                    },
                    isAuthenticated: true
                }
            })
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        renderMenu({ initialUser: null });
        openMenu();

        expect(screen.queryByTestId('language-switcher')).not.toBeInTheDocument();

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        // Never flashes into existence for the signed-in visitor.
        expect(screen.queryByTestId('language-switcher')).not.toBeInTheDocument();
        expect(screen.queryByTestId('theme-control')).not.toBeInTheDocument();
    });
});
