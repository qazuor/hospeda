/**
 * @file ProfileEditSecuritySection.test.tsx
 * @description Regression for HOS-2431: the voluntary change-password page was
 * unreachable because nothing linked to it. The edit-profile form must expose a
 * Security section with a link to `/{locale}/mi-cuenta/cambiar-contrasena/`.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfileEditSecuritySection } from '../../../src/components/account/ProfileEditSecuritySection';
import { tFromCatalog } from '../../helpers/i18n-catalog';

describe('ProfileEditSecuritySection (HOS-2431)', () => {
    it('links to the change-password page for the active locale', () => {
        render(
            <ProfileEditSecuritySection
                locale="es"
                t={tFromCatalog}
            />
        );
        const link = screen.getByRole('link', { name: /cambiar contraseña/i });
        expect(link.getAttribute('href')).toBe('/es/mi-cuenta/cambiar-contrasena/');
    });

    it('builds the link with the English locale prefix', () => {
        render(
            <ProfileEditSecuritySection
                locale="en"
                t={tFromCatalog}
            />
        );
        const link = screen.getByRole('link');
        expect(link.getAttribute('href')).toBe('/en/mi-cuenta/cambiar-contrasena/');
    });
});
