/**
 * @file MobileMenu.cta.test.tsx
 * @description RTL tests for the mobile menu's owner/host-mode CTA
 * (SPEC-182 D3). Migrated from the old source-level
 * `MobileMenuIsland.test.ts` (which asserted on `MobileMenuIsland.astro`'s
 * source) as part of moving this logic into `MobileMenu.client.tsx` — the
 * CTA now depends on the client-resolved `role`, since `MobileMenuIsland`
 * no longer runs as a `server:defer` island with a guaranteed-fresh session.
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
    // HOS-217: MobileMenu now also calls useMyEntitlements (to refine the
    // HOST-mode CTA against real entitlements), which reads Better Auth's
    // useSession directly. Perpetually-pending by default — these tests are
    // about role-driven CTA switching, not entitlement resolution, so
    // `entitlementsLoading` should stay `true` throughout (the hook's own
    // fail-open default) and never override the role-based expectations
    // below. Tests that DO care about the entitlement-resolved state mock
    // this per-case.
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
    initialUser: null as { id: string; name: string; email: string } | null,
    initialRole: null as string | null,
    adminPanelUrl: 'https://admin.test'
};

function renderMenu(overrides: Partial<typeof DEFAULT_PROPS> = {}) {
    return render(
        <MobileMenu
            {...DEFAULT_PROPS}
            {...overrides}
        />
    );
}

function openMenu() {
    act(() => {
        window.dispatchEvent(new CustomEvent('mobile-menu:toggle'));
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MobileMenu — owner/host-mode CTA (SPEC-182 D3)', () => {
    beforeEach(() => {
        sessionStorage.clear();
        global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it('shows the /publicar owner CTA for a guest (no role)', () => {
        renderMenu();
        openMenu();

        const cta = screen.getByRole('link', { name: /publica tu alojamiento/i });
        expect(cta).toHaveAttribute('href', '/es/publicar/');
    });

    it('shows the /publicar owner CTA for an authenticated non-host role', () => {
        renderMenu({
            initialUser: { id: 'u1', name: 'Tourist', email: 'tourist@example.com' },
            initialRole: 'USER'
        });
        openMenu();

        const cta = screen.getByRole('link', { name: /publica tu alojamiento/i });
        expect(cta).toHaveAttribute('href', '/es/publicar/');
    });

    it('switches to the host-mode CTA (admin panel link) when initialRole is HOST and adminPanelUrl is configured', () => {
        renderMenu({
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRole: 'HOST'
        });
        openMenu();

        const cta = screen.getByRole('link', { name: /modo anfitrión/i });
        expect(cta).toHaveAttribute('href', 'https://admin.test');
        expect(
            screen.queryByRole('link', { name: /publica tu alojamiento/i })
        ).not.toBeInTheDocument();
    });

    it('falls back to the /publicar CTA when role is HOST but adminPanelUrl is not configured', () => {
        renderMenu({
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRole: 'HOST',
            adminPanelUrl: undefined
        });
        openMenu();

        const cta = screen.getByRole('link', { name: /publica tu alojamiento/i });
        expect(cta).toHaveAttribute('href', '/es/publicar/');
    });

    it('renders on first paint from initialRole, before the client cache/fetch resolves (fetch never resolves in this test)', () => {
        // No cache seeded and fetch never resolves — this asserts the SSR
        // hint alone (initialRole) is enough to render the correct CTA
        // synchronously, matching the old server:defer first-paint guarantee
        // on pages whose middleware DID parse the session.
        renderMenu({
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRole: 'HOST'
        });
        openMenu();

        expect(screen.getByRole('link', { name: /modo anfitrión/i })).toBeInTheDocument();
    });

    it('upgrades the CTA to host-mode once auth resolves role=HOST (SSR hint was a guest default)', async () => {
        // SSR hint says guest (e.g. a public page whose middleware didn't
        // parse the session), and — since it contradicts an authenticated
        // cache — the hook refetches for real rather than trusting a stale
        // cache (see the hook's SSR-reconciliation contract). The fetch
        // resolves the true state: an authenticated HOST.
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    actor: {
                        id: 'u1',
                        name: 'Host User',
                        email: 'host@example.com',
                        role: 'HOST',
                        permissions: ['accommodation.create']
                    },
                    isAuthenticated: true
                }
            })
        }) as unknown as typeof fetch;

        renderMenu({ initialUser: null, initialRole: null });
        openMenu();

        expect(screen.getByRole('link', { name: /publica tu alojamiento/i })).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /modo anfitrión/i })).toBeInTheDocument();
        });
    });

    it('demotes the CTA back to /publicar once the client cache resolves a mismatched, non-host reconciliation', async () => {
        // SSR hint (from a session-parsed page) said HOST, but the cache
        // disagrees on auth state entirely (session ended between SSR and
        // hydration) — reconciliation must win, not the stale SSR hint.
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: false,
                user: null,
                permissions: [],
                role: null,
                cachedAt: Date.now()
            })
        );
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { actor: null, isAuthenticated: false } })
        }) as unknown as typeof fetch;

        renderMenu({
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRole: 'HOST'
        });
        openMenu();

        await waitFor(() => {
            expect(
                screen.getByRole('link', { name: /publica tu alojamiento/i })
            ).toBeInTheDocument();
        });
        expect(screen.queryByRole('link', { name: /modo anfitrión/i })).not.toBeInTheDocument();
    });

    it('does not treat ADMIN as host-mode (mobile CTA only checks HOST — visibility, not destination, is Header.astro’s concern)', () => {
        renderMenu({
            initialUser: { id: 'u1', name: 'Admin User', email: 'admin@example.com' },
            initialRole: 'ADMIN'
        });
        openMenu();

        const cta = screen.getByRole('link', { name: /publica tu alojamiento/i });
        expect(cta).toHaveAttribute('href', '/es/publicar/');
    });

    it('CTA link includes the BuildingIcon leading icon via aria-hidden', () => {
        renderMenu();
        openMenu();

        const cta = screen.getByRole('link', { name: /publica tu alojamiento/i });
        // fireEvent not needed — just confirm the icon markup renders (icon
        // component itself is not mocked here, so this asserts an <svg> exists).
        expect(cta.querySelector('svg')).not.toBeNull();
    });
});
