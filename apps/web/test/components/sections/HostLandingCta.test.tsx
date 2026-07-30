/**
 * @file HostLandingCta.test.tsx
 * @description Tests for the /publicar landing CTA state machine (SPEC-182
 * T-016, HOS-311, HOS-296).
 *
 * States:
 *  - unauthenticated (or still resolving) → primary CTA links to signin with a
 *    redirect back to the wizard
 *  - authenticated non-HOST (tourist) → primary CTA links to the create wizard
 *  - HOST → also the create wizard (HOS-311: `publicar/index.astro` already
 *    SSR-redirects any actor with >=1 owned accommodation to their properties
 *    list, so the only host who reaches this CTA has ZERO properties and an
 *    empty list would be a pointless extra click)
 *
 * The defect HOS-311 fixes: the host branch used to hand the CTA the ADMIN
 * PANEL origin, which a HOST cannot open (HOS-152 removed `ACCESS_PANEL_ADMIN`
 * from that role, so the panel answers
 * `/auth/forbidden?reason=host-missing-permission`).
 *
 * HOS-296: the island no longer reads Better Auth's `useSession()` and no
 * longer hand-casts `session.user` to `{ role?: string }`. It resolves through
 * `useAccountPermissions` — the shared `/auth/me` plumbing — so these tests
 * mock that hook, and every fixture carries a role SET rather than a scalar.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostLandingCta } from '@/components/sections/HostLandingCta.client';
import { useAccountPermissions } from '@/hooks/use-account-permissions';

vi.mock('@/hooks/use-account-permissions', () => ({
    useAccountPermissions: vi.fn()
}));

const mockUseAccountPermissions = vi.mocked(useAccountPermissions);

const PROPERTIES_HREF = '/es/mi-cuenta/propiedades/';
const WIZARD_HREF = '/es/publicar/nueva/';

const authStateFor = (
    user: { id: string } | null,
    roles: readonly string[] = []
): ReturnType<typeof useAccountPermissions> => ({
    user: user ? { id: user.id, name: 'Test User', email: 'test@example.com' } : null,
    permissions: user ? [] : null,
    roles
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe('HostLandingCta', () => {
    it('links the primary CTA to signin (with wizard redirect) when unauthenticated', () => {
        mockUseAccountPermissions.mockReturnValue(authStateFor(null));

        render(<HostLandingCta locale="es" />);

        const cta = screen.getByRole('link', { name: /publicar tu propiedad/i });
        expect(cta).toHaveAttribute('href', expect.stringContaining('/es/auth/signin/?redirect='));
    });

    it('hides the secondary link while the session is still resolving', () => {
        // The safe first-paint fallback: `user` is null until `/auth/me` (or
        // the shared cache) answers.
        mockUseAccountPermissions.mockReturnValue(authStateFor(null));

        render(<HostLandingCta locale="es" />);

        expect(screen.queryByRole('link', { name: /ver mis propiedades/i })).toBeNull();
    });

    it('links the primary CTA to the create wizard for an authenticated tourist (USER only)', () => {
        mockUseAccountPermissions.mockReturnValue(authStateFor({ id: 'u1' }, ['USER']));

        render(<HostLandingCta locale="es" />);

        const cta = screen.getByRole('link', { name: /publicar tu propiedad/i });
        expect(cta).toHaveAttribute('href', WIZARD_HREF);
    });

    // HOS-311: `publicar/index.astro` SSR-redirects any authenticated actor
    // with >=1 owned accommodation (drafts included) to their properties list,
    // so a HOST who still sees this CTA has ZERO properties. Sending them to an
    // empty list put one dead click between them and the wizard.
    it('sends a HOST to the create wizard, NOT the properties list', () => {
        mockUseAccountPermissions.mockReturnValue(authStateFor({ id: 'u1' }, ['USER', 'HOST']));

        render(<HostLandingCta locale="es" />);

        const cta = screen.getByRole('link', { name: /publicar tu propiedad/i });
        expect(cta).toHaveAttribute('href', WIZARD_HREF);
        expect(cta).not.toHaveAttribute('href', PROPERTIES_HREF);
    });

    it('treats a multi-hat actor (HOST + COMMERCE_OWNER) exactly like any other signed-in actor', () => {
        // HOS-296 AC-1: under the old scalar `role` an account could only carry
        // ONE hat, so a merchant-and-host resolved to whichever value won. The
        // island now consumes the whole set — and, since HOS-311 removed the
        // role branch entirely, the set cannot change the destination.
        mockUseAccountPermissions.mockReturnValue(
            authStateFor({ id: 'u1' }, ['USER', 'COMMERCE_OWNER', 'HOST'])
        );

        render(<HostLandingCta locale="es" />);

        expect(screen.getByRole('link', { name: /publicar tu propiedad/i })).toHaveAttribute(
            'href',
            WIZARD_HREF
        );
        expect(screen.getByRole('link', { name: /ver mis propiedades/i })).toHaveAttribute(
            'href',
            PROPERTIES_HREF
        );
    });

    it('keeps the properties list reachable through the secondary link for a HOST', () => {
        mockUseAccountPermissions.mockReturnValue(authStateFor({ id: 'u1' }, ['USER', 'HOST']));

        render(<HostLandingCta locale="es" />);

        expect(screen.getByRole('link', { name: /ver mis propiedades/i })).toHaveAttribute(
            'href',
            PROPERTIES_HREF
        );
    });

    it('never renders an absolute (admin-panel) link for a HOST', () => {
        // The original HOS-311 defect: the primary CTA was the admin panel
        // origin, which a HOST cannot open (HOS-152). Every href must stay a
        // locale-prefixed internal path.
        mockUseAccountPermissions.mockReturnValue(authStateFor({ id: 'u1' }, ['USER', 'HOST']));

        const { container } = render(<HostLandingCta locale="es" />);

        const externalLinks = Array.from(container.querySelectorAll('a')).filter((anchor) =>
            /^https?:/i.test(anchor.getAttribute('href') ?? '')
        );
        expect(externalLinks).toEqual([]);
    });

    it('keeps the secondary "my properties" link for an authenticated tourist', () => {
        mockUseAccountPermissions.mockReturnValue(authStateFor({ id: 'u1' }, ['USER']));

        render(<HostLandingCta locale="es" />);

        expect(screen.getByRole('link', { name: /ver mis propiedades/i })).toHaveAttribute(
            'href',
            PROPERTIES_HREF
        );
    });

    it('hides the secondary "my properties" link for a guest', () => {
        mockUseAccountPermissions.mockReturnValue(authStateFor(null));

        render(<HostLandingCta locale="es" />);

        expect(
            screen.queryByRole('link', { name: /ver mis propiedades/i })
        ).not.toBeInTheDocument();
    });

    // HOS-311: `host.landing.primaryCta` / `secondaryCta` were the literal
    // string "[TODO]" in en/pt, so a non-Spanish visitor either saw "[TODO]" or
    // the Spanish `t()` fallback baked into the component.
    it('translates the landing CTAs in en instead of rendering the Spanish fallback or [TODO]', () => {
        mockUseAccountPermissions.mockReturnValue(authStateFor({ id: 'u1' }, ['USER', 'HOST']));

        render(<HostLandingCta locale="en" />);

        expect(screen.getByRole('link', { name: /^list your property$/i })).toHaveAttribute(
            'href',
            '/en/publicar/nueva/'
        );
        expect(screen.getByRole('link', { name: /^view my properties$/i })).toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: /publicar tu propiedad/i })
        ).not.toBeInTheDocument();
    });
});
