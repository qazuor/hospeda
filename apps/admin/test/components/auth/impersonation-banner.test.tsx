/**
 * ImpersonationBanner Component Tests
 *
 * Tests the impersonation warning banner.
 * Verifies:
 * - Not rendered when not impersonating
 * - Rendered when impersonatedBy is set
 * - Shows user displayName or falls back to email
 * - Stop impersonation behavior
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockStopImpersonating = vi.fn().mockResolvedValue(undefined);

// Mock auth context - controllable state
let mockAuthState: {
    user: {
        id: string;
        role: string;
        permissions: string[];
        displayName?: string;
        email?: string;
    } | null;
    impersonatedBy?: string;
    isLoading: boolean;
    isAuthenticated: boolean;
    error: null;
    refreshSession: () => Promise<void>;
    clearSession: () => void;
    signOut: () => Promise<void>;
} = {
    user: {
        id: 'user-1',
        role: 'ADMIN',
        permissions: [],
        displayName: 'Impersonated User',
        email: 'impersonated@example.com'
    },
    impersonatedBy: undefined,
    isLoading: false,
    isAuthenticated: true,
    error: null,
    refreshSession: vi.fn(),
    clearSession: vi.fn(),
    signOut: vi.fn()
};

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => mockAuthState
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string, params?: Record<string, string>) => {
            if (key === 'admin-common.impersonation.banner' && params?.userName) {
                return `Impersonating ${params.userName}`;
            }
            if (key === 'admin-common.impersonation.stop') {
                return 'Stop';
            }
            return key;
        }
    })
}));

vi.mock('@/lib/auth-client', () => ({
    authClient: {
        admin: {
            stopImpersonating: () => mockStopImpersonating()
        }
    }
}));

vi.mock('@phosphor-icons/react', () => ({
    Warning: ({ className }: { size: number; className: string }) => (
        <span
            data-testid="warning-icon"
            className={className}
        >
            Warning
        </span>
    ),
    X: () => <span data-testid="x-icon">X</span>
}));

import { ImpersonationBanner } from '@/components/auth/ImpersonationBanner';

describe('ImpersonationBanner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthState = {
            user: {
                id: 'user-1',
                role: 'ADMIN',
                permissions: [],
                displayName: 'Impersonated User',
                email: 'impersonated@example.com'
            },
            impersonatedBy: undefined,
            isLoading: false,
            isAuthenticated: true,
            error: null,
            refreshSession: vi.fn(),
            clearSession: vi.fn(),
            signOut: vi.fn()
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should not render when impersonatedBy is undefined', () => {
        const { container } = render(<ImpersonationBanner />);
        expect(container.innerHTML).toBe('');
    });

    it('should not render when impersonatedBy is empty', () => {
        mockAuthState.impersonatedBy = '';
        const { container } = render(<ImpersonationBanner />);
        expect(container.innerHTML).toBe('');
    });

    it('should render warning banner when impersonatedBy is set', () => {
        mockAuthState.impersonatedBy = 'admin-user-id';
        render(<ImpersonationBanner />);

        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should show user displayName', () => {
        mockAuthState.impersonatedBy = 'admin-user-id';
        render(<ImpersonationBanner />);

        expect(screen.getByText('Impersonating Impersonated User')).toBeInTheDocument();
    });

    it('should fall back to email when no displayName', () => {
        mockAuthState.impersonatedBy = 'admin-user-id';
        mockAuthState.user = {
            id: 'user-1',
            role: 'ADMIN',
            permissions: [],
            displayName: undefined,
            email: 'impersonated@example.com'
        };
        render(<ImpersonationBanner />);

        expect(screen.getByText('Impersonating impersonated@example.com')).toBeInTheDocument();
    });

    it('should call stopImpersonating on stop click', async () => {
        const user = userEvent.setup();
        mockAuthState.impersonatedBy = 'admin-user-id';

        // Mock window.location
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { ...originalLocation, href: '' }
        });

        // Mock sessionStorage
        const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

        render(<ImpersonationBanner />);

        await user.click(screen.getByText('Stop'));

        await waitFor(() => {
            expect(mockStopImpersonating).toHaveBeenCalled();
        });

        expect(removeItemSpy).toHaveBeenCalledWith('hospeda_user_session');
        expect(removeItemSpy).toHaveBeenCalledWith('hospeda_session_timestamp');

        // Restore
        Object.defineProperty(window, 'location', {
            writable: true,
            value: originalLocation
        });
        removeItemSpy.mockRestore();
    });
});
