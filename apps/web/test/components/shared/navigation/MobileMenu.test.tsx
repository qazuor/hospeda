/**
 * @file MobileMenu.test.tsx
 * @description RTL tests for MobileMenu React island — sign-out loading state.
 *
 * Covers:
 * - SPEC-228 T-022: sign-out button shows LoadingButton/Spinner, NOT '...'
 * - sign-out button is aria-busy while signing out
 * - sign-out button is disabled while signing out
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileMenu } from '../../../../src/components/shared/navigation/MobileMenu.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../../src/components/shared/navigation/MobileMenu.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../../src/components/shared/feedback/LoadingButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../../src/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../../src/components/shared/preferences/LanguageSwitcher.client', () => ({
    LanguageSwitcher: () => <div data-testid="language-switcher" />
}));

vi.mock('../../../../src/components/shared/preferences/ThemeControl.client', () => ({
    ThemeControl: () => <div data-testid="theme-control" />
}));

vi.mock('../../../../src/components/ui/IconButtonReact', () => ({
    IconButton: ({
        children,
        onClick,
        ariaLabel
    }: {
        children: React.ReactNode;
        onClick?: () => void;
        ariaLabel: string;
    }) => (
        <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel}
        >
            {children}
        </button>
    )
}));

vi.mock('@repo/icons', () => ({
    CloseIcon: () => <span data-testid="icon-close" />,
    BuildingIcon: () => <span data-testid="icon-building" />,
    ChevronDownIcon: () => <span data-testid="icon-chevron" />,
    UserIcon: () => <span data-testid="icon-user" />,
    LogoutIcon: () => <span data-testid="icon-logout" />,
    SearchIcon: () => <span data-testid="icon-search" />
}));

// Mock auth-client signOut — returns a never-resolving promise to capture loading state
const mockSignOut = vi.fn();
vi.mock('../../../../src/lib/auth-client', () => ({
    signOut: () => mockSignOut()
}));

vi.mock('../../../../src/lib/avatar-utils', () => ({
    getInitials: ({ name }: { name: string }) => name.slice(0, 2).toUpperCase()
}));

vi.mock('../../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path }: { locale: string; path?: string }) => `/${locale}/${path ?? ''}/`
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
    locale: 'es' as const,
    navItems: [{ label: 'Inicio', href: '/es/' }],
    currentPath: '/es/',
    logoSrc: '/logo.svg',
    homeHref: '/es/',
    user: {
        name: 'Ana García',
        email: 'ana@example.com'
    }
};

function renderMenu(overrides: Partial<typeof DEFAULT_PROPS> = {}) {
    return render(
        <MobileMenu
            {...DEFAULT_PROPS}
            {...overrides}
        />
    );
}

/** Opens the menu by dispatching the custom toggle event. */
function openMenu() {
    act(() => {
        window.dispatchEvent(new CustomEvent('mobile-menu:toggle'));
    });
}

/** Opens the menu then expands the account submenu. */
function openAccountMenu() {
    openMenu();
    const userRow = screen.getByRole('button', { name: /Ana García/i });
    fireEvent.click(userRow);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MobileMenu — sign-out loading state (SPEC-228 T-022)', () => {
    beforeEach(() => {
        mockSignOut.mockClear();
        vi.stubGlobal('location', { reload: vi.fn() });
    });

    it('renders the sign-out button with the correct idle label', () => {
        renderMenu();
        openAccountMenu();

        expect(screen.getByRole('button', { name: /cerrar sesion/i })).toBeInTheDocument();
    });

    it('sign-out button does NOT show "..." text in idle state', () => {
        renderMenu();
        openAccountMenu();

        const btn = screen.getByRole('button', { name: /cerrar sesion/i });
        expect(btn.textContent).not.toContain('...');
    });

    it('sign-out button is NOT aria-busy when idle', () => {
        renderMenu();
        openAccountMenu();

        const btn = screen.getByRole('button', { name: /cerrar sesion/i });
        expect(btn).not.toHaveAttribute('aria-busy', 'true');
    });

    it('shows loading label while signing out (LoadingButton contract)', async () => {
        // signOut never resolves — keeps loading state active
        mockSignOut.mockReturnValue(new Promise(() => {}));

        renderMenu();
        openAccountMenu();

        fireEvent.click(screen.getByRole('button', { name: /cerrar sesion/i }));

        // LoadingButton renders the loadingLabel text while loading
        await waitFor(() => {
            expect(screen.getByText(/cerrando sesion/i)).toBeInTheDocument();
        });
    });

    it('sign-out button is aria-busy=true while signing out', async () => {
        mockSignOut.mockReturnValue(new Promise(() => {}));

        renderMenu();
        openAccountMenu();

        fireEvent.click(screen.getByRole('button', { name: /cerrar sesion/i }));

        await waitFor(() => {
            // While loading, LoadingButton sets aria-busy on the button
            const btn = document.querySelector('[aria-busy="true"]');
            expect(btn).not.toBeNull();
        });
    });

    it('sign-out button is disabled while signing out', async () => {
        mockSignOut.mockReturnValue(new Promise(() => {}));

        renderMenu();
        openAccountMenu();

        fireEvent.click(screen.getByRole('button', { name: /cerrar sesion/i }));

        await waitFor(() => {
            // The button becomes disabled when loading
            const btn = document.querySelector('[aria-busy="true"]');
            expect(btn).toHaveAttribute('disabled');
        });
    });

    it('does NOT show "..." text anywhere while signing out', async () => {
        mockSignOut.mockReturnValue(new Promise(() => {}));

        renderMenu();
        openAccountMenu();

        fireEvent.click(screen.getByRole('button', { name: /cerrar sesion/i }));

        await waitFor(() => {
            expect(screen.getByText(/cerrando sesion/i)).toBeInTheDocument();
        });

        expect(document.body.textContent).not.toContain('...');
    });
});
