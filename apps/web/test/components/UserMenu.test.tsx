/**
 * @file UserMenu.test.tsx
 * @description Unit tests for the UserMenu React island.
 *
 * Covers:
 * - Unauthenticated render (sign-in button, correct href)
 * - Authenticated render (avatar or initials, trigger button)
 * - Open/close dropdown
 * - Menu item navigation (closes dropdown on click)
 * - Escape key closes dropdown
 * - Sign-out calls signOut and redirects
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserMenu } from '../../src/components/UserMenu.client';
import type { UserMenuUser } from '../../src/components/UserMenu.client';

// ─── Module mocks ────────────────────────────────────────────────────────────

vi.mock('../../src/lib/auth-client', () => ({
    signOut: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/components/UserMenu.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../src/lib/avatar-utils', () => ({
    getInitials: ({ name }: { name?: string | null }) => {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
        return `${(parts[0] ?? '').charAt(0)}${(parts[parts.length - 1] ?? '').charAt(0)}`.toUpperCase();
    }
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_USER: UserMenuUser = {
    id: 'user-1',
    displayName: 'Carlos Ramírez',
    slug: 'carlos-ramirez'
};

const MOCK_USER_WITH_AVATAR: UserMenuUser = {
    id: 'user-2',
    displayName: 'Ana López',
    avatarUrl: 'https://example.com/avatar.jpg',
    slug: 'ana-lopez'
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderUnauthenticated() {
    return render(
        <UserMenu
            user={null}
            locale="es"
        />
    );
}

function renderAuthenticated(user: UserMenuUser = MOCK_USER) {
    return render(
        <UserMenu
            user={user}
            locale="es"
        />
    );
}

function openDropdown() {
    const trigger = screen.getByRole('button', { name: /abrir menú/i });
    fireEvent.click(trigger);
    return trigger;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UserMenu — unauthenticated', () => {
    it('renders a sign-in link', () => {
        renderUnauthenticated();
        const link = screen.getByRole('link', { name: /iniciar sesión/i });
        expect(link).toBeInTheDocument();
    });

    it('sign-in link points to /{locale}/auth/signin/', () => {
        renderUnauthenticated();
        const link = screen.getByRole('link', { name: /iniciar sesión/i });
        expect(link).toHaveAttribute('href', '/es/auth/signin/');
    });

    it('does not render a trigger button', () => {
        renderUnauthenticated();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('respects the locale prop', () => {
        render(
            <UserMenu
                user={null}
                locale="en"
            />
        );
        const link = screen.getByRole('link', { name: /sign in/i });
        expect(link).toHaveAttribute('href', '/en/auth/signin/');
    });
});

describe('UserMenu — authenticated render', () => {
    it('renders the trigger button', () => {
        renderAuthenticated();
        expect(screen.getByRole('button', { name: /abrir menú/i })).toBeInTheDocument();
    });

    it('trigger has aria-expanded=false initially', () => {
        renderAuthenticated();
        const trigger = screen.getByRole('button', { name: /abrir menú/i });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('trigger has aria-haspopup="menu"', () => {
        renderAuthenticated();
        const trigger = screen.getByRole('button', { name: /abrir menú/i });
        expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('renders initials when no avatarUrl is provided', () => {
        renderAuthenticated(MOCK_USER);
        // CR = Carlos Ramírez
        expect(screen.getByText('CR')).toBeInTheDocument();
    });

    it('renders an avatar img when avatarUrl is provided', () => {
        const { container } = renderAuthenticated(MOCK_USER_WITH_AVATAR);
        // avatar has aria-hidden="true" so queryByRole won't find it — use querySelector
        const avatar = container.querySelector('img[aria-hidden="true"]');
        expect(avatar).not.toBeNull();
        expect(avatar).toHaveAttribute('src', MOCK_USER_WITH_AVATAR.avatarUrl);
    });

    it('does not show the dropdown initially', () => {
        renderAuthenticated();
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
});

describe('UserMenu — dropdown open/close', () => {
    it('opens the dropdown when trigger is clicked', () => {
        renderAuthenticated();
        openDropdown();
        expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('trigger aria-expanded becomes true when dropdown is open', () => {
        renderAuthenticated();
        const trigger = openDropdown();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes dropdown when trigger is clicked again', () => {
        renderAuthenticated();
        const trigger = openDropdown();
        fireEvent.click(trigger);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes dropdown when Escape is pressed', () => {
        renderAuthenticated();
        openDropdown();
        expect(screen.getByRole('menu')).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
});

describe('UserMenu — dropdown items', () => {
    beforeEach(() => {
        renderAuthenticated();
        openDropdown();
    });

    it('shows all 6 menu items', () => {
        expect(screen.getByRole('menuitem', { name: /mi cuenta/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /editar perfil/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /mis propiedades/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /mis mensajes/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /mis favoritos/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /cerrar sesión/i })).toBeInTheDocument();
    });

    it('"Mi cuenta" links to /{locale}/mi-cuenta/', () => {
        const item = screen.getByRole('menuitem', { name: /mi cuenta/i });
        expect(item).toHaveAttribute('href', '/es/mi-cuenta/');
    });

    it('"Editar perfil" links to /{locale}/mi-cuenta/editar/', () => {
        const item = screen.getByRole('menuitem', { name: /editar perfil/i });
        expect(item).toHaveAttribute('href', '/es/mi-cuenta/editar/');
    });

    it('"Mis propiedades" links to /{locale}/mi-cuenta/propiedades/', () => {
        const item = screen.getByRole('menuitem', { name: /mis propiedades/i });
        expect(item).toHaveAttribute('href', '/es/mi-cuenta/propiedades/');
    });

    it('"Mis mensajes" links to /{locale}/mi-cuenta/mensajes/', () => {
        const item = screen.getByRole('menuitem', { name: /mis mensajes/i });
        expect(item).toHaveAttribute('href', '/es/mi-cuenta/mensajes/');
    });

    it('"Mis favoritos" links to /{locale}/mi-cuenta/favoritos/', () => {
        const item = screen.getByRole('menuitem', { name: /mis favoritos/i });
        expect(item).toHaveAttribute('href', '/es/mi-cuenta/favoritos/');
    });

    it('clicking a link item closes the dropdown', () => {
        const item = screen.getByRole('menuitem', { name: /mi cuenta/i });
        fireEvent.click(item);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
});

describe('UserMenu — sign-out', () => {
    it('calls signOut when "Cerrar sesión" is clicked', async () => {
        const { signOut } = await import('../../src/lib/auth-client');
        renderAuthenticated();
        openDropdown();

        const signOutBtn = screen.getByRole('menuitem', { name: /cerrar sesión/i });
        fireEvent.click(signOutBtn);

        await waitFor(() => {
            expect(signOut).toHaveBeenCalled();
        });
    });

    it('closes the dropdown when sign-out is clicked', () => {
        renderAuthenticated();
        openDropdown();

        const signOutBtn = screen.getByRole('menuitem', { name: /cerrar sesión/i });
        fireEvent.click(signOutBtn);

        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
});
