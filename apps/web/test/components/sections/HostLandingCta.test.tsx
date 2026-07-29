/**
 * @file HostLandingCta.test.tsx
 * @description Tests for the /publicar landing CTA state machine (SPEC-182
 * T-016, HOS-311).
 *
 * States:
 *  - unauthenticated → primary CTA links to signin with redirect to the wizard
 *  - authenticated non-HOST (tourist) → primary CTA links to the create wizard
 *  - HOST → also the create wizard (HOS-311: `publicar/index.astro` already
 *    SSR-redirects any actor with >=1 owned accommodation to their properties
 *    list, so the only host who reaches this CTA has ZERO properties and an
 *    empty list would be a pointless extra click)
 *  - HOST whose entitlements RESOLVED with no owner subscription (`plan ==
 *    null`) → primary CTA links to the owner plans page
 *
 * HOS-311 rebuilt the third state: it used to key on the absence of
 * `PUBLISH_ACCOMMODATIONS`/`EDIT_ACCOMMODATION_INFO`, a population that does
 * not exist (the API grants both to every plan-less HOST via the
 * `owner-basico` draft defaults) — the only real triggers were a fetch error
 * or a transient render, i.e. it nagged PAYING hosts.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { Profiler, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostLandingCta } from '@/components/sections/HostLandingCta.client';
import { useSession } from '@/lib/auth-client';
import { getEntitlementsCached } from '@/lib/entitlements-cache';

vi.mock('@/lib/auth-client', () => ({
    useSession: vi.fn()
}));

// HOS-311: the CTA is subscription-aware now. Mock the shared cache (not the
// hook) so the real `useMyEntitlements` — including its `skip` short-circuit,
// its `hasResolved` contract and its fail-open behaviour — stays under test.
vi.mock('@/lib/entitlements-cache', () => ({
    getEntitlementsCached: vi.fn(() => new Promise(() => {})),
    clearEntitlementsCache: vi.fn(),
    ENTITLEMENTS_CACHE_TTL_MS: 60_000
}));

const mockUseSession = vi.mocked(useSession);

const PROPERTIES_HREF = '/es/mi-cuenta/propiedades/';
const PLANS_HREF = '/es/suscriptores/planes/';
const WIZARD_HREF = '/es/publicar/nueva/';

/** The nag label, in every locale it is asserted against. */
const NAG_ES = /activá tu plan/i;

const sessionFor = (user: { id: string; role?: string } | null, isPending = false) =>
    ({
        data: user ? { user } : null,
        isPending
    }) as unknown as ReturnType<typeof useSession>;

/** An owner subscription payload, as the entitlements endpoint returns it. */
const OWNER_PLAN = { slug: 'owner-basico', name: 'Owner Básico', status: 'active' } as const;

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
    vi.mocked(getEntitlementsCached).mockResolvedValue({
        entitlements,
        limits: {},
        plan,
        asOf: new Date().toISOString()
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` wipes the factory implementation too — restore the
    // "never resolves" default so an un-stubbed test keeps entitlements loading.
    vi.mocked(getEntitlementsCached).mockImplementation(() => new Promise(() => {}));
});

describe('HostLandingCta', () => {
    it('links the primary CTA to signin (with wizard redirect) when unauthenticated', () => {
        mockUseSession.mockReturnValue(sessionFor(null));

        render(<HostLandingCta locale="es" />);

        const cta = screen.getByRole('link', { name: /publicar tu propiedad/i });
        expect(cta).toHaveAttribute('href', expect.stringContaining('/es/auth/signin/?redirect='));
    });

    it('links the primary CTA to the create wizard for an authenticated tourist (role=USER)', () => {
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'USER' }));

        render(<HostLandingCta locale="es" />);

        const cta = screen.getByRole('link', { name: /publicar tu propiedad/i });
        expect(cta).toHaveAttribute('href', WIZARD_HREF);
    });

    // HOS-311 FIX 6: `publicar/index.astro` SSR-redirects any authenticated
    // actor with >=1 owned accommodation (drafts included) to their properties
    // list, so a HOST who still sees this CTA has ZERO properties. Sending them
    // to an empty list put one dead click between them and the wizard.
    it('sends a subscribed HOST to the create wizard, NOT the properties list', async () => {
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        resolveEntitlements({ plan: OWNER_PLAN, entitlements: ['publish_accommodations'] });

        render(<HostLandingCta locale="es" />);

        await waitFor(() => {
            expect(vi.mocked(getEntitlementsCached)).toHaveBeenCalled();
        });

        const cta = screen.getByRole('link', { name: /publicar tu propiedad/i });
        expect(cta).toHaveAttribute('href', WIZARD_HREF);
        expect(cta).not.toHaveAttribute('href', PROPERTIES_HREF);
    });

    it('keeps the properties list reachable through the secondary link for a subscribed HOST', async () => {
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        resolveEntitlements({ plan: OWNER_PLAN });

        render(<HostLandingCta locale="es" />);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /ver mis propiedades/i })).toHaveAttribute(
                'href',
                PROPERTIES_HREF
            );
        });
    });

    // ------------------------------------------------------------------
    // The third state — the nag
    // ------------------------------------------------------------------

    it('shows the nag ONLY when the resolved subscription is null (plan == null)', async () => {
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        resolveEntitlements({ plan: null });

        render(<HostLandingCta locale="es" />);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: NAG_ES })).toBeInTheDocument();
        });
    });

    // HOS-311 FIX 4: `resolveSubscriptionPlansPath` is the documented single
    // source of truth, and BETA-195 deliberately chose `suscriptores/planes`
    // over `mi-cuenta/suscripcion` because it handles the cross-category
    // tourist→owner upgrade — which is exactly one of the two real populations
    // that can reach this state.
    it('points the nag at the owner plans page (suscriptores/planes), not mi-cuenta/suscripcion', async () => {
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        resolveEntitlements({ plan: null });

        render(<HostLandingCta locale="es" />);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: NAG_ES })).toHaveAttribute('href', PLANS_HREF);
        });
    });

    // HOS-311 FIX 1: the population the old condition targeted does not exist.
    // A plan-less HOST gets the `owner-basico` draft defaults from the API, so
    // it is entirely possible to hold PUBLISH_ACCOMMODATIONS with plan == null;
    // and conversely a subscribed host must never be nagged just because some
    // entitlement key is missing from their plan.
    it('does NOT nag a subscribed HOST whose plan lacks the publishing entitlement keys', async () => {
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        resolveEntitlements({ plan: OWNER_PLAN, entitlements: ['view_own_dashboard'] });

        render(<HostLandingCta locale="es" />);

        await waitFor(() => {
            expect(vi.mocked(getEntitlementsCached)).toHaveBeenCalled();
        });

        expect(screen.queryByRole('link', { name: NAG_ES })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: /publicar tu propiedad/i })).toHaveAttribute(
            'href',
            WIZARD_HREF
        );
    });

    // HOS-311 FIX 2: `Header.astro` resolves the same thing server-side on the
    // same page load and fails OPEN on purpose ("never nag a paying host").
    // A 429 on the entitlements endpoint is documented as having happened
    // (HOS-109) — the two surfaces must not contradict each other.
    it('fails OPEN when the entitlements fetch errors — no nag (429/500 is not "no plan")', async () => {
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        vi.mocked(getEntitlementsCached).mockRejectedValue(new Error('Too Many Requests'));

        render(<HostLandingCta locale="es" />);

        await waitFor(() => {
            expect(vi.mocked(getEntitlementsCached)).toHaveBeenCalled();
        });
        // Let the rejection settle and any resulting commit happen.
        await waitFor(() => {
            expect(screen.getByRole('link', { name: /publicar tu propiedad/i })).toHaveAttribute(
                'href',
                WIZARD_HREF
            );
        });
        expect(screen.queryByRole('link', { name: NAG_ES })).not.toBeInTheDocument();
    });

    it('does NOT nag while entitlements are still loading', () => {
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        // getEntitlementsCached stays pending (beforeEach default).

        render(<HostLandingCta locale="es" />);

        expect(screen.queryByRole('link', { name: NAG_ES })).not.toBeInTheDocument();
    });

    it('never renders an absolute (admin-panel) link for a HOST', async () => {
        // The original HOS-311 defect: the primary CTA was the admin panel
        // origin, which a HOST cannot open (HOS-152). Every href must stay a
        // locale-prefixed internal path.
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        resolveEntitlements({ plan: null });

        const { container } = render(<HostLandingCta locale="es" />);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: NAG_ES })).toBeInTheDocument();
        });

        const externalLinks = Array.from(container.querySelectorAll('a')).filter((anchor) =>
            /^https?:/i.test(anchor.getAttribute('href') ?? '')
        );
        expect(externalLinks).toEqual([]);
    });

    it('keeps the secondary "my properties" link for an authenticated tourist', () => {
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'USER' }));

        render(<HostLandingCta locale="es" />);

        expect(screen.getByRole('link', { name: /ver mis propiedades/i })).toHaveAttribute(
            'href',
            PROPERTIES_HREF
        );
    });

    it('translates the landing CTAs in en instead of rendering the Spanish fallback or [TODO]', async () => {
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        resolveEntitlements({ plan: null });

        render(<HostLandingCta locale="en" />);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /^activate your plan$/i })).toHaveAttribute(
                'href',
                '/en/suscriptores/planes/'
            );
        });
        expect(screen.queryByRole('link', { name: NAG_ES })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: /^view my properties$/i })).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Commit-sequence tests (HOS-311 FIX 3)
// ---------------------------------------------------------------------------
//
// RTL's `act()` swallows intermediate commits: asserting on the FINAL DOM is
// exactly why the previous "does NOT flash" test passed while the flash was
// real in production. These tests snapshot the rendered CTA on EVERY commit via
// a `<Profiler onRender>` and assert on the whole sequence.
//
// The production always-path is reproduced faithfully: on `/publicar` the
// island is `client:only="react"`, so there is NO SSR role hint and the session
// starts PENDING. `skip` therefore flips `true -> false` when the session
// resolves to HOST, and the hook's skip branch leaves a stale
// `isLoading = false` behind — the exact window the nag used to appear in.

/** One captured commit: the primary CTA's label + href. */
type Commit = string;

function renderWithCommitLog(node: ReactElement): {
    readonly commits: Commit[];
    readonly rerender: (next: ReactElement) => void;
} {
    const commits: Commit[] = [];
    const onRender = () => {
        const anchor = document.querySelector('a');
        commits.push(
            anchor
                ? `${anchor.textContent?.replace(/\s+/g, ' ').trim()}|${anchor.getAttribute('href')}`
                : 'none'
        );
    };
    const wrap = (child: ReactElement) => (
        <Profiler
            id="cta"
            onRender={onRender}
        >
            {child}
        </Profiler>
    );
    const utils = render(wrap(node));
    return {
        commits,
        rerender: (next: ReactElement) => utils.rerender(wrap(next))
    };
}

/**
 * Awaits every entitlements promise the component actually kicked off, inside
 * `act`, so the resulting commits are flushed. Deliberately NOT a DOM
 * assertion: the sequence assertions below must depend only on the flash fix,
 * never on which destination the terminal state happens to point at.
 */
async function flushEntitlements(): Promise<void> {
    await act(async () => {
        await Promise.allSettled(
            vi.mocked(getEntitlementsCached).mock.results.map((result) => result.value)
        );
    });
}

describe('HostLandingCta — commit sequence (HOS-311 flash)', () => {
    it('never commits the nag for a subscribed HOST whose session resolves asynchronously', async () => {
        // 1. Session PENDING (the client:only always-path — no SSR role hint).
        mockUseSession.mockReturnValue(sessionFor(null, true));
        resolveEntitlements({ plan: OWNER_PLAN, entitlements: ['publish_accommodations'] });

        const { commits, rerender } = renderWithCommitLog(<HostLandingCta locale="es" />);

        // 2. Session resolves to a HOST — `skip` flips true -> false and the
        //    hook's skip branch has already left `isLoading = false` behind.
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        rerender(<HostLandingCta locale="es" />);

        await waitFor(() => {
            expect(vi.mocked(getEntitlementsCached)).toHaveBeenCalled();
        });
        await flushEntitlements();

        // The transition must actually have happened — a sequence of one or two
        // commits would mean the test never exercised the un-skip window.
        expect(commits.length).toBeGreaterThanOrEqual(3);
        // NO commit in the whole sequence may show the nag.
        expect(commits.filter((commit) => /activá tu plan/i.test(commit))).toEqual([]);
        expect(commits.filter((commit) => commit.includes(PLANS_HREF))).toEqual([]);
    });

    it('still commits the nag (as the terminal state) for a HOST who genuinely has no plan', async () => {
        // Guards the flash fix against over-correction: gating on `hasResolved`
        // must not make the third state unreachable.
        mockUseSession.mockReturnValue(sessionFor(null, true));
        resolveEntitlements({ plan: null });

        const { commits, rerender } = renderWithCommitLog(<HostLandingCta locale="es" />);

        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        rerender(<HostLandingCta locale="es" />);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: NAG_ES })).toBeInTheDocument();
        });

        // It appears, and only at the END — never mid-transition.
        const nagIndexes = commits
            .map((commit, index) => (/activá tu plan/i.test(commit) ? index : -1))
            .filter((index) => index >= 0);
        expect(nagIndexes.length).toBeGreaterThan(0);
        expect(nagIndexes[nagIndexes.length - 1]).toBe(commits.length - 1);
    });
});
