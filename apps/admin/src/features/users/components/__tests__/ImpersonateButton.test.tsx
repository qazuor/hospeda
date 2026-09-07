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
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImpersonateButton, performImpersonation } from '../ImpersonateButton';

// The permission gate is tested separately; render children unconditionally so
// these assertions are about the button itself.
vi.mock('@/components/auth/PermissionGate', () => ({
    PermissionGate: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>
}));

// `vi.hoisted` because the factory below is lifted above every import.
const { mockImpersonateUser, mockAddToast, mockIsImpersonationEnabled } = vi.hoisted(() => ({
    mockImpersonateUser: vi.fn(),
    mockAddToast: vi.fn(),
    // Defaults to the real HOS-354-pending value (disabled). Only the
    // confirmation-gate contract test below flips it, and resets it in its
    // own afterEach — every other test in this file exercises the honest
    // disabled state.
    mockIsImpersonationEnabled: vi.fn(() => false)
}));
vi.mock('@/lib/auth-client', () => ({
    authClient: { admin: { impersonateUser: mockImpersonateUser } }
}));
vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ addToast: mockAddToast })
}));
vi.mock('../impersonation-flag', () => ({
    isImpersonationEnabled: mockIsImpersonationEnabled
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
 * Confirmation-gate contract (HOS-1198).
 *
 * The whole point of this migration is that the confirm dialog sits BETWEEN
 * the click and the impersonation call — not just that a dialog component
 * exists somewhere in the tree. `IMPERSONATION_ENABLED` keeps the button
 * disabled pending HOS-354, so this is the one place in the suite that flips
 * {@link isImpersonationEnabled} (via the mocked `../impersonation-flag`
 * module) to actually click the enabled button and prove the gate holds: a
 * single click must NOT reach `authClient.admin.impersonateUser` — it may
 * only open the dialog. A future "simplify the handler" refactor that calls
 * the action directly from the click (skipping the dialog) must turn this
 * test red.
 */
describe('ImpersonateButton — confirmation gate holds when enabled', () => {
    beforeEach(() => {
        mockIsImpersonationEnabled.mockReturnValue(true);
        mockImpersonateUser.mockReset();
    });

    afterEach(() => {
        mockIsImpersonationEnabled.mockReturnValue(false);
    });

    it('opens the confirm dialog on click and does NOT call impersonateUser before confirming', async () => {
        const user = userEvent.setup();
        render(
            <ImpersonateButton
                userId={USER_ID}
                variant="icon"
            />
        );

        const button = screen.getByRole('button');
        expect((button as HTMLButtonElement).disabled).toBe(false);

        await user.click(button);

        // The dialog opened...
        expect(screen.getByText('admin-common.impersonation.confirm')).toBeInTheDocument();
        // ...but the click alone must NOT have performed the action yet.
        expect(mockImpersonateUser).not.toHaveBeenCalled();
    });

    it('only calls impersonateUser after the dialog is explicitly confirmed', async () => {
        mockImpersonateUser.mockResolvedValue({ error: null });
        const user = userEvent.setup();
        // performImpersonation redirects via window.location.href on success;
        // jsdom doesn't implement real navigation, so stub it for this test
        // like the isolated performImpersonation success test does.
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, href: '' }
        });

        render(
            <ImpersonateButton
                userId={USER_ID}
                variant="icon"
            />
        );

        await user.click(screen.getByRole('button'));
        expect(mockImpersonateUser).not.toHaveBeenCalled();

        await user.click(screen.getByTestId('impersonate-confirm-action'));

        expect(mockImpersonateUser).toHaveBeenCalledExactlyOnceWith({ userId: USER_ID });

        Object.defineProperty(window, 'location', {
            configurable: true,
            value: originalLocation
        });
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
