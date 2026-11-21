/**
 * @file ChangePasswordForm.copy.test.tsx
 * @description Regression for HOS-2431: the page copy only suited the forced
 * case ("necesitás actualizar tu contraseña antes de continuar"). A voluntary
 * visit must not tell the user they are blocked.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChangePasswordForm } from '../../../src/components/auth/ChangePasswordForm.client';

vi.mock('../../../src/lib/auth-client', () => ({
    refreshBetterAuthSession: vi.fn()
}));

describe('ChangePasswordForm copy (HOS-2431)', () => {
    it('keeps the "before continuing" copy for the forced flow', () => {
        render(
            <ChangePasswordForm
                locale="es"
                accountEmail="a@b.c"
                returnUrl="/es/mi-cuenta/"
                forced
            />
        );
        expect(screen.getByText(/antes de continuar/i)).toBeInTheDocument();
    });

    it('uses voluntary copy when the change is not forced', () => {
        render(
            <ChangePasswordForm
                locale="es"
                accountEmail="a@b.c"
                returnUrl="/es/mi-cuenta/"
                forced={false}
            />
        );
        expect(screen.queryByText(/antes de continuar/i)).not.toBeInTheDocument();
        expect(screen.getByText(/elegí una contraseña nueva/i)).toBeInTheDocument();
    });
});
