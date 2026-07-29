/**
 * @file HostLandingCta.test.tsx
 * @description Tests for the /publicar landing CTA three-state logic (SPEC-182 T-016).
 *
 * States:
 *  - unauthenticated → primary CTA links to signin with redirect to the wizard
 *  - authenticated non-HOST (tourist) → primary CTA links to the create wizard
 *  - authenticated holder of the HOST hat → primary CTA links to the admin panel
 *
 * HOS-296: the island no longer reads Better Auth's `useSession()` and no
 * longer hand-casts `session.user` to `{ role?: string }`. It resolves through
 * `useAccountPermissions` — the shared `/auth/me` plumbing — so these tests
 * mock the hook instead. The regression this guards against is silent: with
 * `users.role` gone, the old cast yielded `undefined` forever and the host CTA
 * simply never appeared, with no compile or runtime error to notice.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostLandingCta } from '@/components/sections/HostLandingCta.client';
import { useAccountPermissions } from '@/hooks/use-account-permissions';

vi.mock('@/hooks/use-account-permissions', () => ({
    useAccountPermissions: vi.fn()
}));

const mockUseAccountPermissions = vi.mocked(useAccountPermissions);

const ADMIN_URL = 'https://admin.hospeda.com.ar';

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

        render(
            <HostLandingCta
                locale="es"
                adminUrl={ADMIN_URL}
            />
        );

        const cta = screen.getByRole('link', { name: /publicar tu propiedad/i });
        expect(cta).toHaveAttribute('href', expect.stringContaining('/es/auth/signin/?redirect='));
    });

    it('links the primary CTA to signin while the session is still resolving', () => {
        // The safe SSG/first-paint fallback: `user` is null until `/auth/me`
        // (or the shared cache) answers.
        mockUseAccountPermissions.mockReturnValue(authStateFor(null));

        render(
            <HostLandingCta
                locale="es"
                adminUrl={ADMIN_URL}
            />
        );

        expect(screen.queryByRole('link', { name: /ver mis propiedades/i })).toBeNull();
    });

    it('links the primary CTA to the create wizard for an authenticated tourist (USER only)', () => {
        mockUseAccountPermissions.mockReturnValue(authStateFor({ id: 'u1' }, ['USER']));

        render(
            <HostLandingCta
                locale="es"
                adminUrl={ADMIN_URL}
            />
        );

        const cta = screen.getByRole('link', { name: /publicar tu propiedad/i });
        expect(cta).toHaveAttribute('href', '/es/publicar/nueva/');
    });

    it('links the primary CTA to the admin panel for a HOST (host mode, SPEC-182)', () => {
        mockUseAccountPermissions.mockReturnValue(authStateFor({ id: 'u1' }, ['USER', 'HOST']));

        render(
            <HostLandingCta
                locale="es"
                adminUrl={ADMIN_URL}
            />
        );

        const cta = screen.getByRole('link', { name: /panel/i });
        expect(cta).toHaveAttribute('href', ADMIN_URL);
    });

    it('keeps host mode for a HOST who ALSO holds COMMERCE_OWNER (HOS-296 AC-1)', () => {
        // Under the old scalar `role` this user's single value could only be
        // one hat, so a merchant-and-host lost the host CTA entirely.
        mockUseAccountPermissions.mockReturnValue(
            authStateFor({ id: 'u1' }, ['USER', 'COMMERCE_OWNER', 'HOST'])
        );

        render(
            <HostLandingCta
                locale="es"
                adminUrl={ADMIN_URL}
            />
        );

        const cta = screen.getByRole('link', { name: /panel/i });
        expect(cta).toHaveAttribute('href', ADMIN_URL);
    });

    it('falls back to the create wizard for a HOST when adminUrl is not configured', () => {
        mockUseAccountPermissions.mockReturnValue(authStateFor({ id: 'u1' }, ['USER', 'HOST']));

        render(
            <HostLandingCta
                locale="es"
                adminUrl={undefined}
            />
        );

        const cta = screen.getByRole('link', { name: /publicar tu propiedad/i });
        expect(cta).toHaveAttribute('href', '/es/publicar/nueva/');
    });

    it('keeps the secondary "my properties" link for authenticated users', () => {
        mockUseAccountPermissions.mockReturnValue(authStateFor({ id: 'u1' }, ['USER', 'HOST']));

        render(
            <HostLandingCta
                locale="es"
                adminUrl={ADMIN_URL}
            />
        );

        expect(screen.getByRole('link', { name: /ver mis propiedades/i })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/propiedades/'
        );
    });
});
