/**
 * @file AuthRequiredPopover.test.tsx
 * @description Unit tests for the AuthRequiredPopover component (HOS-1185).
 *
 * Until this fix, AuthRequiredPopover had NO test file of its own, even
 * though it is the component that actually assembles the sign-in and
 * register hrefs — every consumer test (FavoriteButton, CompareModeToggle)
 * mocks it away entirely, so a bug in how it builds those two links could
 * never surface anywhere.
 *
 * Coverage:
 * - The sign-in link carries `returnUrl` (pre-existing behavior, pinned here).
 * - The register link ALSO carries `returnUrl` (HOS-1185 C2 fix — it
 *   previously always pointed to a bare `/auth/signup/` with no return
 *   destination, so registering from this popover silently dropped the
 *   visitor on `/mi-cuenta/` instead of back where they started, the same
 *   symptom the sign-in half of this issue fixed).
 * - Both links degrade to no `returnUrl` param cleanly when none is passed.
 */

import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthRequiredPopover } from '../../../src/components/auth/AuthRequiredPopover.client';

vi.mock('@repo/icons', () => ({
    FavoriteIcon: () => <svg aria-hidden="true" />,
    UserIcon: () => <svg aria-hidden="true" />
}));

/** Renders AuthRequiredPopover with a real anchor element so it mounts past the SSR guard. */
function renderPopover(props: Partial<Parameters<typeof AuthRequiredPopover>[0]> = {}) {
    function Harness() {
        const anchorRef = useRef<HTMLButtonElement>(null);
        return (
            <>
                <button
                    type="button"
                    ref={anchorRef}
                >
                    trigger
                </button>
                <AuthRequiredPopover
                    anchorRef={anchorRef}
                    message="Debes iniciar sesion"
                    onClose={() => undefined}
                    locale="es"
                    {...props}
                />
            </>
        );
    }
    return render(<Harness />);
}

describe('AuthRequiredPopover — returnUrl on both auth links (HOS-1185)', () => {
    it('carries returnUrl on the sign-in link', () => {
        renderPopover({ returnUrl: '/es/alojamientos/entity-1/?foo=bar' });

        const signInLink = screen.getByRole('link', { name: /iniciar sesion/i });
        expect(signInLink).toHaveAttribute(
            'href',
            '/es/auth/signin/?returnUrl=%2Fes%2Falojamientos%2Fentity-1%2F%3Ffoo%3Dbar'
        );
    });

    it('carries the SAME returnUrl on the register link (C2 — previously missing)', () => {
        renderPopover({ returnUrl: '/es/alojamientos/entity-1/?foo=bar' });

        const registerLink = screen.getByRole('link', { name: /crear cuenta/i });
        expect(registerLink).toHaveAttribute(
            'href',
            '/es/auth/signup/?returnUrl=%2Fes%2Falojamientos%2Fentity-1%2F%3Ffoo%3Dbar'
        );
    });

    it('never sends an absolute URL as returnUrl on either link', () => {
        renderPopover({ returnUrl: '/es/alojamientos/entity-1/?foo=bar' });

        const signInHref = screen
            .getByRole('link', { name: /iniciar sesion/i })
            .getAttribute('href');
        const registerHref = screen
            .getByRole('link', { name: /crear cuenta/i })
            .getAttribute('href');

        expect(signInHref?.includes('http')).toBe(false);
        expect(registerHref?.includes('http')).toBe(false);
    });

    it('degrades to no returnUrl value on both links when none is provided', () => {
        renderPopover();

        expect(screen.getByRole('link', { name: /iniciar sesion/i })).toHaveAttribute(
            'href',
            '/es/auth/signin/?returnUrl='
        );
        expect(screen.getByRole('link', { name: /crear cuenta/i })).toHaveAttribute(
            'href',
            '/es/auth/signup/?returnUrl='
        );
    });
});
