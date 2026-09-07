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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImpersonateButton, performImpersonation } from '../ImpersonateButton';

// The permission gate is tested separately; render children unconditionally so
// these assertions are about the button itself.
vi.mock('@/components/auth/PermissionGate', () => ({
    PermissionGate: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>
}));

// `vi.hoisted` because the factory below is lifted above every import.
const { mockImpersonateUser, mockAddToast } = vi.hoisted(() => ({
    mockImpersonateUser: vi.fn(),
    mockAddToast: vi.fn()
}));
vi.mock('@/lib/auth-client', () => ({
    authClient: { admin: { impersonateUser: mockImpersonateUser } }
}));
vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ addToast: mockAddToast })
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

/**
 * performImpersonation — the extracted async action (HOS-1198).
 *
 * The button that triggers this stays disabled pending HOS-354, so the
 * confirm-dialog/toast path can't be exercised through a rendered click.
 * This function was pulled out specifically so the error handling that used
 * to live behind `alert()` — both the "confirmed impersonation, API said no"
 * branch and the "unexpected throw" branch — has real coverage instead of
 * being untestable dead code until HOS-354 ships.
 */
describe('performImpersonation', () => {
    const t = (key: string) => key;

    beforeEach(() => {
        mockImpersonateUser.mockReset();
        mockAddToast.mockReset();
        sessionStorage.setItem('hospeda_user_session', 'stale-session');
        sessionStorage.setItem('hospeda_session_timestamp', '123');
    });

    it('clears the cached session and navigates on success, without toasting', async () => {
        mockImpersonateUser.mockResolvedValue({ error: null });
        const originalLocation = window.location;
        // jsdom's `window.location` setter throws "Not implemented: navigation"
        // on a bare assignment, so redefine the property for the duration of
        // this test — the standard workaround for asserting a redirect target.
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, href: '' }
        });

        const result = await performImpersonation({ userId: USER_ID, addToast: mockAddToast, t });

        expect(result).toEqual({ success: true });
        expect(mockAddToast).not.toHaveBeenCalled();
        expect(sessionStorage.getItem('hospeda_user_session')).toBeNull();
        expect(sessionStorage.getItem('hospeda_session_timestamp')).toBeNull();
        expect(window.location.href).toBe('/dashboard');

        Object.defineProperty(window, 'location', {
            configurable: true,
            value: originalLocation
        });
    });

    it('toasts an error and does NOT navigate when the API returns result.error', async () => {
        mockImpersonateUser.mockResolvedValue({ error: { message: 'Forbidden' } });

        const result = await performImpersonation({ userId: USER_ID, addToast: mockAddToast, t });

        expect(result).toEqual({ success: false });
        expect(mockAddToast).toHaveBeenCalledExactlyOnceWith({
            message: 'admin-common.impersonation.error',
            variant: 'error'
        });
        // The stale session must NOT be cleared on failure — a failed
        // impersonation attempt should not log the admin out of their own session.
        expect(sessionStorage.getItem('hospeda_user_session')).toBe('stale-session');
    });

    it('toasts an error and does NOT navigate when the call throws', async () => {
        mockImpersonateUser.mockRejectedValue(new Error('network down'));

        const result = await performImpersonation({ userId: USER_ID, addToast: mockAddToast, t });

        expect(result).toEqual({ success: false });
        expect(mockAddToast).toHaveBeenCalledExactlyOnceWith({
            message: 'admin-common.impersonation.error',
            variant: 'error'
        });
        expect(sessionStorage.getItem('hospeda_user_session')).toBe('stale-session');
    });
});
