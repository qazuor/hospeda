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
 * `access.panelAdmin` from the HOST role, so that destination 403s), and a
 * third state was added for a HOST whose entitlement resolves negative.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { Profiler, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileMenu } from '../../../../src/components/shared/navigation/MobileMenu.client';
import { AUTH_ME_CACHE_KEY } from '../../../../src/lib/auth-cache';
import { useSession } from '../../../../src/lib/auth-client';
import { getEntitlementsCached } from '../../../../src/lib/entitlements-cache';
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

// HOS-311: the entitlement-resolved CTA states need deterministic control over
// what `useMyEntitlements` resolves to. Mocking the shared cache module (not
// the hook) keeps the real hook — including its `skip` short-circuit and its
// "fail-open while loading" contract — under test.
vi.mock('../../../../src/lib/entitlements-cache', () => ({
    getEntitlementsCached: vi.fn(() => new Promise(() => {})),
    clearEntitlementsCache: vi.fn(),
    ENTITLEMENTS_CACHE_TTL_MS: 60_000
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
/**
 * HOS-311 FIX 4: the nag targets the OWNER PLANS page via the documented
 * single source of truth `resolveSubscriptionPlansPath`, not
 * `mi-cuenta/suscripcion` — BETA-195 chose it deliberately because it handles
 * the cross-category tourist→owner upgrade, one of the two real populations
 * that can reach this state.
 */
const PLANS_HREF = '/es/suscriptores/planes/';
const PUBLICAR_HREF = '/es/publicar/';

/** The nag label. */
const NAG_ES = /activá tu plan/i;

/** An owner subscription payload, as the entitlements endpoint returns it. */
const OWNER_PLAN = { slug: 'owner-basico', name: 'Owner Básico', status: 'active' } as const;

/** Marks Better Auth's session as resolved+authenticated (the hook gates on it). */
function authenticateSession() {
    vi.mocked(useSession).mockReturnValue({
        data: { user: { id: 'u1' } },
        isPending: false
    } as unknown as ReturnType<typeof useSession>);
}

/**
 * Makes `useMyEntitlements` resolve. `plan` is the signal the CTA keys on;
 * `entitlements` is kept only to prove the CTA no longer reads it.
 */
function resolveEntitlements({
    plan,
    entitlements = []
}: {
    plan: typeof OWNER_PLAN | null;
    entitlements?: readonly string[];
}) {
    authenticateSession();
    vi.mocked(getEntitlementsCached).mockResolvedValue({
        entitlements,
        limits: {},
        plan,
        asOf: new Date().toISOString()
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

describe('MobileMenu — host CTA never reaches the admin panel (HOS-311)', () => {
    beforeEach(() => {
        sessionStorage.clear();
        global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it('sends a subscribed HOST to their properties list', async () => {
        resolveEntitlements({ plan: OWNER_PLAN, entitlements: ['publish_accommodations'] });

        renderMenu({
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRole: 'HOST'
        });
        openMenu();

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /modo anfitrión/i })).toHaveAttribute(
                'href',
                PROPERTIES_HREF
            );
        });
    });

    it('sends a HOST with NO owner subscription (plan == null) to the owner plans page', async () => {
        resolveEntitlements({ plan: null });

        renderMenu({
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRole: 'HOST'
        });
        openMenu();

        await waitFor(() => {
            expect(screen.getByRole('link', { name: NAG_ES })).toHaveAttribute('href', PLANS_HREF);
        });
        expect(screen.queryByRole('link', { name: /modo anfitrión/i })).not.toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: /publica tu alojamiento/i })
        ).not.toBeInTheDocument();
    });

    // HOS-311 FIX 1: the old condition (missing PUBLISH_ACCOMMODATIONS /
    // EDIT_ACCOMMODATION_INFO) targets a population that does not exist — the
    // API grants both to every plan-less HOST via the `owner-basico` draft
    // defaults. Conversely a SUBSCRIBED host must never be nagged just because
    // their plan happens not to carry those keys.
    it('does NOT nag a subscribed HOST whose plan lacks the publishing entitlement keys', async () => {
        resolveEntitlements({ plan: OWNER_PLAN, entitlements: ['view_own_dashboard'] });

        renderMenu({
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRole: 'HOST'
        });
        openMenu();

        await waitFor(() => {
            expect(vi.mocked(getEntitlementsCached)).toHaveBeenCalled();
        });
        await waitFor(() => {
            expect(screen.getByRole('link', { name: /modo anfitrión/i })).toHaveAttribute(
                'href',
                PROPERTIES_HREF
            );
        });
        expect(screen.queryByRole('link', { name: NAG_ES })).not.toBeInTheDocument();
    });

    // HOS-311 FIX 2: `Header.astro` resolves the same thing server-side on the
    // same page load and fails OPEN on purpose (`let hostHasEntitlement = true`,
    // "never nag a paying host"). A 429 on the entitlements endpoint is
    // documented as having happened (HOS-109) — the two surfaces must agree.
    it('fails OPEN when the entitlements fetch errors — no nag (429/500 is not "no plan")', async () => {
        authenticateSession();
        vi.mocked(getEntitlementsCached).mockRejectedValue(new Error('Too Many Requests'));

        renderMenu({
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRole: 'HOST'
        });
        openMenu();

        await waitFor(() => {
            expect(vi.mocked(getEntitlementsCached)).toHaveBeenCalled();
        });
        await waitFor(() => {
            expect(screen.getByRole('link', { name: /modo anfitrión/i })).toHaveAttribute(
                'href',
                PROPERTIES_HREF
            );
        });
        expect(screen.queryByRole('link', { name: NAG_ES })).not.toBeInTheDocument();
    });

    // HOS-311 FIX 5: `needsPlan` used to read `role === 'HOST'` with NO user
    // check at all (unlike `HostLandingCta`, which gates on
    // `isAuthenticated && role === 'HOST'`). The props allow a role hint
    // without a resolved user, and in that state the menu must fall back to
    // the funnel rather than nag someone it cannot even identify.
    it('does NOT nag when the role hint says HOST but no user is resolved', async () => {
        resolveEntitlements({ plan: null });
        // /auth/me never settles, so `user` stays at the (null) SSR seed while
        // `role` keeps the stale HOST hint.
        global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;

        renderMenu({ initialUser: null, initialRole: 'HOST' });
        openMenu();

        await waitFor(() => {
            expect(vi.mocked(getEntitlementsCached)).toHaveBeenCalled();
        });
        await waitFor(() => {
            expect(screen.getByRole('link', { name: /modo anfitrión/i })).toBeInTheDocument();
        });
        expect(screen.queryByRole('link', { name: NAG_ES })).not.toBeInTheDocument();
    });

    it('does NOT flash the "activate your plan" state while entitlements are still loading', () => {
        // `getEntitlementsCached` stays pending (module-mock default), so the
        // nag must not appear (fail-open, deliberate).
        authenticateSession();

        renderMenu({
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRole: 'HOST'
        });
        openMenu();

        expect(screen.getByRole('link', { name: /modo anfitrión/i })).toHaveAttribute(
            'href',
            PROPERTIES_HREF
        );
        expect(screen.queryByRole('link', { name: NAG_ES })).not.toBeInTheDocument();
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

    it.each([
        ['subscribed', OWNER_PLAN, /modo anfitrión/i],
        ['no subscription', null, NAG_ES]
    ] as const)('renders NO link pointing at the admin panel for a HOST (%s)', async (_label, plan, ctaName) => {
        // The actual defect: clicking the host CTA landed on
        // /auth/forbidden?reason=host-missing-permission. Pin the
        // destination directly — no anchor anywhere in the menu may target
        // the admin URL (the session-zone admin link is permission-gated
        // and a HOST has no `access.panelAdmin`, so it must stay absent).
        resolveEntitlements({ plan });
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
            expect(screen.getByRole('link', { name: ctaName })).toBeInTheDocument();
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

    it('translates the "activate your plan" CTA in en (nav.activatePlanCta must exist)', async () => {
        resolveEntitlements({ plan: null });

        renderMenu({
            locale: 'en',
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRole: 'HOST'
        });
        openMenu();

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /^activate your plan$/i })).toHaveAttribute(
                'href',
                '/en/suscriptores/planes/'
            );
        });
    });
});

// ---------------------------------------------------------------------------
// Commit-sequence tests (HOS-311 FIX 3)
// ---------------------------------------------------------------------------
//
// RTL's `act()` swallows intermediate commits, which is exactly why the old
// "does NOT flash" test passed while the flash was real: it handed the
// component an ALREADY-RESOLVED HOST, so `skip` was false from render 1 and
// the un-skip transition never happened. These tests reproduce the real path
// (role arrives from the `/auth/me` reconciliation, AFTER mount) and snapshot
// the CTA on EVERY commit via `<Profiler onRender>`.

/** One captured commit: the CTA link's label + href. */
type Commit = string;

function renderWithCommitLog(node: ReactElement): { readonly commits: Commit[] } {
    const commits: Commit[] = [];
    const onRender = () => {
        const anchor = document.querySelector('a.ctaLink');
        commits.push(
            anchor
                ? `${anchor.textContent?.replace(/\s+/g, ' ').trim()}|${anchor.getAttribute('href')}`
                : 'none'
        );
    };
    render(
        <Profiler
            id="mobile-menu"
            onRender={onRender}
        >
            {node}
        </Profiler>
    );
    return { commits };
}

describe('MobileMenu — CTA commit sequence (HOS-311 flash)', () => {
    beforeEach(() => {
        sessionStorage.clear();
        global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it('never commits the nag for a subscribed HOST whose role arrives from /auth/me after mount', async () => {
        // No SSR hint at all (a public page whose middleware didn't parse the
        // session) — `skip` starts TRUE, so the hook's skip branch resolves
        // `isLoading` to false without any fetch. When /auth/me then reports
        // HOST, `skip` flips to false and that stale resolved-false is exactly
        // what used to render one committed "Activá tu plan" frame.
        resolveEntitlements({ plan: OWNER_PLAN, entitlements: ['publish_accommodations'] });
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

        const { commits } = renderWithCommitLog(<MobileMenu {...DEFAULT_PROPS} />);
        openMenu();

        await waitFor(() => {
            expect(vi.mocked(getEntitlementsCached)).toHaveBeenCalled();
        });
        await act(async () => {
            await Promise.allSettled(
                vi.mocked(getEntitlementsCached).mock.results.map((result) => result.value)
            );
        });

        // The transition must actually have happened.
        expect(commits.length).toBeGreaterThanOrEqual(3);
        expect(commits.some((commit) => commit.includes(PROPERTIES_HREF))).toBe(true);
        // NO commit in the whole sequence may show the nag.
        expect(commits.filter((commit) => /activá tu plan/i.test(commit))).toEqual([]);
        expect(commits.filter((commit) => commit.includes(PLANS_HREF))).toEqual([]);
    });

    it('still commits the nag (as the terminal state) for a HOST who genuinely has no plan', async () => {
        // Guards the flash fix against over-correction: gating on `hasResolved`
        // must not make the third state unreachable.
        resolveEntitlements({ plan: null });
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

        const { commits } = renderWithCommitLog(<MobileMenu {...DEFAULT_PROPS} />);
        openMenu();

        await waitFor(() => {
            expect(screen.getByRole('link', { name: NAG_ES })).toBeInTheDocument();
        });

        const nagIndexes = commits
            .map((commit, index) => (/activá tu plan/i.test(commit) ? index : -1))
            .filter((index) => index >= 0);
        expect(nagIndexes.length).toBeGreaterThan(0);
        expect(nagIndexes[nagIndexes.length - 1]).toBe(commits.length - 1);
    });
});
