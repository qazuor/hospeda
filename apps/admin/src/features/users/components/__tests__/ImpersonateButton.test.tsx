// @vitest-environment jsdom
/**
 * ImpersonateButton — disabled-state tests (HOS-296 → HOS-354).
 *
 * Dropping `users.role` broke Better Auth's `admin()` plugin permission
 * resolution, so every `/api/auth/admin/*` route — impersonation included —
 * answers 403. The failure is CLOSED, but an enabled button that always errors
 * is worse than an honest disabled one, so the affordance is switched off
 * until HOS-354 restores it.
 *
 * These tests pin the two things that make the disabling honest rather than
 * cosmetic: the control cannot be activated, and it SAYS why.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImpersonateButton } from '../ImpersonateButton';

// The permission gate is tested separately; render children unconditionally so
// these assertions are about the button itself.
vi.mock('@/components/auth/PermissionGate', () => ({
    PermissionGate: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>
}));

// `vi.hoisted` because the factory below is lifted above every import.
const { mockImpersonateUser } = vi.hoisted(() => ({ mockImpersonateUser: vi.fn() }));
vi.mock('@/lib/auth-client', () => ({
    authClient: { admin: { impersonateUser: mockImpersonateUser } }
}));

const USER_ID = '22222222-2222-4222-8222-222222222222';
const UNAVAILABLE_KEY = 'admin-common.impersonation.unavailable';

describe('ImpersonateButton — disabled pending HOS-354', () => {
    it.each([
        'icon',
        'full',
        'responsive'
    ] as const)('renders the %s variant disabled', (variant) => {
        render(
            <ImpersonateButton
                userId={USER_ID}
                variant={variant}
            />
        );

        const button = screen.getByRole('button');
        expect((button as HTMLButtonElement).disabled).toBe(true);
    });

    it('explains WHY it is unavailable instead of showing the normal label', () => {
        render(
            <ImpersonateButton
                userId={USER_ID}
                variant="full"
            />
        );

        const button = screen.getByRole('button');
        expect(button.getAttribute('title')).toBe(UNAVAILABLE_KEY);
        expect(button.getAttribute('aria-label')).toBe(UNAVAILABLE_KEY);
        expect(button.textContent).toContain(UNAVAILABLE_KEY);
        expect(button.textContent).not.toContain('admin-common.impersonation.start');
    });

    it('never reaches Better Auth, so no 403 is provoked', () => {
        render(
            <ImpersonateButton
                userId={USER_ID}
                variant="icon"
            />
        );

        fireEvent.click(screen.getByRole('button'));

        expect(mockImpersonateUser).not.toHaveBeenCalled();
    });
});
