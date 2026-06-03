/**
 * @file HostLandingCta.test.tsx
 * @description Tests for the /publicar landing CTA three-state logic (SPEC-182 T-016).
 *
 * States:
 *  - unauthenticated → primary CTA links to signin with redirect to the wizard
 *  - authenticated non-HOST (tourist) → primary CTA links to the create wizard
 *  - authenticated HOST → primary CTA links to the admin panel (host mode)
 */

import { HostLandingCta } from '@/components/sections/HostLandingCta.client';
import { useSession } from '@/lib/auth-client';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-client', () => ({
    useSession: vi.fn()
}));

const mockUseSession = vi.mocked(useSession);

const ADMIN_URL = 'https://admin.hospeda.com.ar';

const sessionFor = (user: { id: string; role?: string } | null, isPending = false) =>
    ({
        data: user ? { user } : null,
        isPending
    }) as unknown as ReturnType<typeof useSession>;

beforeEach(() => {
    vi.clearAllMocks();
});

describe('HostLandingCta', () => {
    it('links the primary CTA to signin (with wizard redirect) when unauthenticated', () => {
        mockUseSession.mockReturnValue(sessionFor(null));

        render(
            <HostLandingCta
                locale="es"
                adminUrl={ADMIN_URL}
            />
        );

        const cta = screen.getByRole('link', { name: /publicar tu propiedad/i });
        expect(cta).toHaveAttribute('href', expect.stringContaining('/es/auth/signin/?redirect='));
    });

    it('links the primary CTA to the create wizard for an authenticated tourist (role=USER)', () => {
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'USER' }));

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
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));

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
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));

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
        mockUseSession.mockReturnValue(sessionFor({ id: 'u1', role: 'HOST' }));

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
