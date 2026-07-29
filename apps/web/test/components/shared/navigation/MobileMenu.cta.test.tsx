/**
 * @file MobileMenu.cta.test.tsx
 * @description RTL tests for the mobile menu's owner/host-mode CTA
 * (SPEC-182 D3). Migrated from the old source-level
 * `MobileMenuIsland.test.ts` (which asserted on `MobileMenuIsland.astro`'s
 * source) as part of moving this logic into `MobileMenu.client.tsx` — the
 * CTA now depends on the client-resolved `role`, since `MobileMenuIsland`
 * no longer runs as a `server:defer` island with a guaranteed-fresh session.
 *
 * HOS-311: the host CTA no longer points at the admin panel (HOS-152 removed
 * `access.panelAdmin` from the HOST role, so that destination 403s) — it stays
 * inside the web app, on the host's own properties list.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileMenu } from '../../../../src/components/shared/navigation/MobileMenu.client';
import { AUTH_ME_CACHE_KEY } from '../../../../src/lib/auth-cache';
import type { SupportedLocale } from '../../../../src/lib/i18n';

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
    // Typed as the full union (not `as const`) so a test can render another
    // locale and assert the CTA labels are really translated (HOS-311).
    locale: 'es' as SupportedLocale,
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

/** Locale-prefixed destinations the CTA can legitimately point at (HOS-311). */
const PROPERTIES_HREF = '/es/mi-cuenta/propiedades/';
const PUBLICAR_HREF = '/es/publicar/';

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

    it('switches to the host-mode CTA (own properties, NOT the admin panel) when initialRole is HOST', () => {
        // HOS-311: this used to assert `href === 'https://admin.test'`. A HOST
        // has no `access.panelAdmin` (HOS-152), so the admin panel answers with
        // /auth/forbidden?reason=host-missing-permission — the CTA now stays in
        // the web app.
        renderMenu({
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRole: 'HOST'
        });
        openMenu();

        const cta = screen.getByRole('link', { name: /modo anfitrión/i });
        expect(cta).toHaveAttribute('href', PROPERTIES_HREF);
        expect(
            screen.queryByRole('link', { name: /publica tu alojamiento/i })
        ).not.toBeInTheDocument();
    });

    it('keeps the host-mode CTA when adminPanelUrl is not configured (the CTA no longer depends on it)', () => {
        // HOS-311: this used to assert the /publicar fallback, because the old
        // host CTA needed an admin URL to point at. The destination is now an
        // internal route, so the env var is irrelevant to it.
        renderMenu({
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRole: 'HOST',
            adminPanelUrl: undefined
        });
        openMenu();

        const cta = screen.getByRole('link', { name: /modo anfitrión/i });
        expect(cta).toHaveAttribute('href', PROPERTIES_HREF);
    });

    it('renders on first paint from the SSR hints, before the client cache/fetch resolves (fetch never resolves in this test)', () => {
        // No cache seeded and fetch never resolves — this asserts the SSR
        // hints alone (initialUser + initialRole) are enough to render the
        // correct CTA synchronously, matching the old server:defer first-paint
        // guarantee on pages whose middleware DID parse the session.
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

describe('MobileMenu — host CTA never reaches the admin panel (HOS-311)', () => {
    beforeEach(() => {
        sessionStorage.clear();
        global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it('sends a HOST to their properties list', () => {
        renderMenu({
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRole: 'HOST'
        });
        openMenu();

        expect(screen.getByRole('link', { name: /modo anfitrión/i })).toHaveAttribute(
            'href',
            PROPERTIES_HREF
        );
    });

    // The props allow a role hint WITHOUT a resolved user (a stale
    // `initialRole: 'HOST'` left over from an expired session on a page whose
    // middleware parsed nothing). The menu must fall back to the funnel rather
    // than offer a host surface to an actor it cannot identify.
    it('falls back to the /publicar funnel when the role hint says HOST but no user is resolved', async () => {
        // /auth/me never settles, so `user` stays at the (null) SSR seed while
        // `role` keeps the stale HOST hint.
        global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;

        renderMenu({ initialUser: null, initialRole: 'HOST' });
        openMenu();

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /publica tu alojamiento/i })).toHaveAttribute(
                'href',
                PUBLICAR_HREF
            );
        });
        expect(screen.queryByRole('link', { name: /modo anfitrión/i })).not.toBeInTheDocument();
    });

    it('keeps the /publicar funnel for everyone who is not a HOST', () => {
        renderMenu({
            initialUser: { id: 'u1', name: 'Tourist', email: 'tourist@example.com' },
            initialRole: 'USER'
        });
        openMenu();

        expect(screen.getByRole('link', { name: /publica tu alojamiento/i })).toHaveAttribute(
            'href',
            PUBLICAR_HREF
        );
    });

    it('renders NO link pointing at the admin panel for a HOST', async () => {
        // The actual defect: clicking the host CTA landed on
        // /auth/forbidden?reason=host-missing-permission. Pin the
        // destination directly — no anchor anywhere in the menu may target
        // the admin URL (the session-zone admin link is permission-gated
        // and a HOST has no `access.panelAdmin`, so it must stay absent).
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    actor: {
                        id: 'u1',
                        name: 'Host User',
                        email: 'host@example.com',
                        role: 'HOST',
                        permissions: ['accommodation.create', 'accommodation.update.own']
                    },
                    isAuthenticated: true
                }
            })
        }) as unknown as typeof fetch;

        const { container } = renderMenu({
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRole: 'HOST'
        });
        openMenu();

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /modo anfitrión/i })).toBeInTheDocument();
        });

        const adminLinks = Array.from(container.querySelectorAll('a')).filter((anchor) =>
            (anchor.getAttribute('href') ?? '').startsWith('https://admin.test')
        );
        expect(adminLinks).toEqual([]);
    });

    it('translates the host CTA instead of falling back to Spanish in en (nav.hostModeCta must exist)', () => {
        // `t('nav.hostModeCta', 'Modo anfitrión')` silently rendered the
        // Spanish fallback in EVERY locale because the key was never added to
        // the catalogue. Assert the real EN string.
        renderMenu({
            locale: 'en',
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRole: 'HOST'
        });
        openMenu();

        expect(screen.getByRole('link', { name: /^host mode$/i })).toHaveAttribute(
            'href',
            '/en/mi-cuenta/propiedades/'
        );
        expect(screen.queryByRole('link', { name: /modo anfitrión/i })).not.toBeInTheDocument();
    });
});
