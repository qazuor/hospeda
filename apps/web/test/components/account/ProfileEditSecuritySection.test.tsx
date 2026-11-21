/**
 * @file ProfileEditSecuritySection.test.tsx
 * @description Regression for HOS-2431: the voluntary change-password page was
 * unreachable because nothing linked to it. The edit-profile form must expose a
 * Security section linking to `/{locale}/mi-cuenta/cambiar-contrasena/`, and an
 * account WITHOUT a password (Google-only) must be sent to the add-password page
 * instead of being told it needs its current one.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfileEditSecuritySection } from '../../../src/components/account/ProfileEditSecuritySection';
import { tFromCatalog } from '../../helpers/i18n-catalog';

const BACK_TO_EDIT = encodeURIComponent('/es/mi-cuenta/editar/');

describe('ProfileEditSecuritySection (HOS-2431)', () => {
    it('links to the change-password page and returns to the edit page', () => {
        render(
            <ProfileEditSecuritySection
                locale="es"
                t={tFromCatalog}
            />
        );
        const link = screen.getByRole('link', { name: /cambiar contraseña/i });
        expect(link.getAttribute('href')).toBe(
            `/es/mi-cuenta/cambiar-contrasena/?returnUrl=${BACK_TO_EDIT}`
        );
    });

    it('builds the link with the English locale prefix', () => {
        render(
            <ProfileEditSecuritySection
                locale="en"
                t={tFromCatalog}
            />
        );
        expect(screen.getByRole('link').getAttribute('href')).toMatch(
            /^\/en\/mi-cuenta\/cambiar-contrasena\/\?returnUrl=/
        );
    });

    it('sends a password-less account to the add-password page with honest copy', () => {
        render(
            <ProfileEditSecuritySection
                locale="es"
                t={tFromCatalog}
                hasPassword={false}
            />
        );
        const link = screen.getByRole('link', { name: /agregar contraseña/i });
        expect(link.getAttribute('href')).toBe(
            `/es/mi-cuenta/agregar-contrasena/?returnUrl=${BACK_TO_EDIT}`
        );
        expect(screen.getByText(/todavía no tenés contraseña/i)).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /cambiar contraseña/i })).toBeNull();
    });
});
