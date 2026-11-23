/**
 * @file OwnerInboxLocked.test.tsx
 * @description The owner inbox gate's two outcomes besides «continue»
 * (HOS-2482, HOS-2433): a signed-in user without the owner permission sees the
 * kit LockedState (`reason.kind = 'permission'`) with no enabled form control,
 * and a signed-out visitor is sent to login with the inbox as the return path.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OwnerInboxLocked } from '../../../../src/components/account/conversations/OwnerInboxLocked';
import { buildLoginRedirect } from '../../../../src/lib/auth-redirect';

describe('OwnerInboxLocked', () => {
    it('renders the permission LockedState inside a Section, with a help link', () => {
        // Arrange / Act
        const { container } = render(<OwnerInboxLocked locale="es" />);

        // Assert
        expect(container.querySelector('[data-reason="permission"]')).not.toBeNull();
        expect(container.querySelector('[data-kit-section]')).toHaveAttribute(
            'data-help',
            'section:owner-messages.list'
        );
        expect(screen.getByText('Mensajes de huéspedes')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Saber más' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/ayuda/inquiries/'
        );
        expect(
            container.querySelectorAll('input, textarea, select, button:not([disabled])')
        ).toHaveLength(0);
    });

    it('is translated in every locale', () => {
        render(<OwnerInboxLocked locale="en" />);
        expect(screen.getByText('Guest messages')).toBeInTheDocument();
    });
});

describe('owner inbox login redirect (HOS-2433)', () => {
    it('carries the inbox path and query as the return URL', () => {
        const target = buildLoginRedirect({
            locale: 'es',
            currentUrl: '/es/mi-cuenta/consultas-propietario/abc/?cursor=x'
        });
        expect(target).toBe(
            `/es/auth/signin/?returnUrl=${encodeURIComponent('/es/mi-cuenta/consultas-propietario/abc/?cursor=x')}`
        );
    });
});
