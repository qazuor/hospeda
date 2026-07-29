/**
 * @file HostLandingCta.test.tsx
 * @description Tests for the /publicar landing CTA state machine (SPEC-182
 * T-016, HOS-311).
 *
 * States:
 *  - unauthenticated → primary CTA links to signin with redirect to the wizard
 *  - authenticated non-HOST (tourist) → primary CTA links to the create wizard
 *  - HOST with the publishing entitlement → primary CTA links to their
 *    properties list (HOS-311: it used to link to the admin panel, which a
 *    HOST cannot open — HOS-152 removed `access.panelAdmin` from that role)
 *  - HOST whose entitlement resolved negative → primary CTA links to the
 *    subscription page so they can activate a plan
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostLandingCta } from '@/components/sections/HostLandingCta.client';
import { useSession } from '@/lib/auth-client';
import { getEntitlementsCached } from '@/lib/entitlements-cache';

vi.mock('@/lib/auth-client', () => ({
    useSession: vi.fn()
}));

// HOS-311: the CTA is entitlement-aware now. Mock the shared cache (not the
// hook) so the real `useMyEntitlements` — including its `skip` short-circuit
// and its fail-open-while-loading contract — stays under test.
vi.mock('@/lib/entitlements-cache', () => ({
    getEntitlementsCached: vi.fn(() => new Promise(() => {})),
    clearEntitlementsCache: vi.fn(),
    ENTITLEMENTS_CACHE_TTL_MS: 60_000
}));

const mockUseSession = vi.mocked(useSession);

const PROPERTIES_HREF = '/es/mi-cuenta/propiedades/';
const SUBSCRIPTION_HREF = '/es/mi-cuenta/suscripcion/';
const WIZARD_HREF = '/es/publicar/nueva/';

const sessionFor = (user: { id: string; role?: string } | null, isPending = false) =>
    ({
        data: user ? { user } : null,
        isPending
    }) as unknown as ReturnType<typeof useSession>;

/** Makes `useMyEntitlements` resolve to the given entitlement keys. */
function resolveEntitlements(entitlements: readonly string[]) {
    vi.mocked(getEntitlementsCached).mockResolvedValue({
        entitlements,
        limits: {},
        plan: null,
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

    it('links the primary CTA to the properties list for an entitled HOST (never the admin panel)', async () => {
        // HOS-311: this assertion used to be `href === adminUrl`.
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        resolveEntitlements(['publish_accommodations']);

        render(<HostLandingCta locale="es" />);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /ir a mis propiedades/i })).toHaveAttribute(
                'href',
                PROPERTIES_HREF
            );
        });
    });

    it('links the primary CTA to the subscription page for a HOST whose entitlement resolved NEGATIVE', async () => {
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        resolveEntitlements(['view_own_dashboard']);

        render(<HostLandingCta locale="es" />);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /activá tu plan/i })).toHaveAttribute(
                'href',
                SUBSCRIPTION_HREF
            );
        });
        expect(
            screen.queryByRole('link', { name: /ir a mis propiedades/i })
        ).not.toBeInTheDocument();
    });

    it('does NOT flash the "activate your plan" state while entitlements are still loading', () => {
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        // getEntitlementsCached stays pending (beforeEach default).

        render(<HostLandingCta locale="es" />);

        expect(screen.getByRole('link', { name: /ir a mis propiedades/i })).toHaveAttribute(
            'href',
            PROPERTIES_HREF
        );
        expect(screen.queryByRole('link', { name: /activá tu plan/i })).not.toBeInTheDocument();
    });

    it.each([
        ['entitled', ['publish_accommodations'], /ir a mis propiedades/i],
        ['not entitled', ['view_own_dashboard'], /activá tu plan/i]
    ] as const)('renders NO absolute (admin-panel) link for a HOST (%s)', async (_label, entitlements, ctaName) => {
        // The actual defect: the primary CTA was the admin panel origin,
        // which a HOST cannot open (HOS-152). Every href must stay a
        // locale-prefixed internal path.
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        resolveEntitlements(entitlements);

        const { container } = render(<HostLandingCta locale="es" />);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: ctaName })).toBeInTheDocument();
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

    it('drops the redundant secondary link when the primary CTA already points at the properties list', () => {
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));

        render(<HostLandingCta locale="es" />);

        expect(screen.getByRole('link', { name: /ir a mis propiedades/i })).toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: /ver mis propiedades/i })
        ).not.toBeInTheDocument();
    });

    it('translates the landing CTAs in en instead of rendering the Spanish fallback or [TODO]', async () => {
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));
        resolveEntitlements(['view_own_dashboard']);

        render(<HostLandingCta locale="en" />);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /^activate your plan$/i })).toHaveAttribute(
                'href',
                '/en/mi-cuenta/suscripcion/'
            );
        });
        expect(screen.queryByRole('link', { name: /activá tu plan/i })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: /^view my properties$/i })).toBeInTheDocument();
    });
});
