/**
 * @file UserMenu.test.tsx
 * @description Tests the rebuilt navbar user menu with role-aware items.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserMenu } from '../../../../src/components/shared/navigation/UserMenu.client';
import type {
    UserMenuProps,
    UserMenuUser
} from '../../../../src/components/shared/navigation/UserMenu.client';
import { AUTH_ME_CACHE_KEY } from '../../../../src/lib/auth-cache';
import { signOut } from '../../../../src/lib/auth-client';

vi.mock('../../../../src/lib/auth-client', () => ({
    signOut: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.test'
}));

const MOCK_USER: UserMenuUser = {
    id: 'user-1',
    name: 'Carlos Ramírez',
    email: 'carlos@example.com'
};

function renderMenu(overrides: Partial<UserMenuProps> = {}) {
    return render(
        <UserMenu
            initialUser={MOCK_USER}
            locale="es"
            currentPath="/es/"
            adminPanelUrl="https://admin.test"
            {...overrides}
        />
    );
}

function open() {
    const trigger = screen.getByRole('button', { name: /abrir menú de cuenta/i });
    fireEvent.click(trigger);
    return trigger;
}

describe('UserMenu — guest', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { actor: null, isAuthenticated: false } })
        }) as unknown as typeof fetch;
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it('renders only a sign-in link when initialUser is null', () => {
        render(
            <UserMenu
                initialUser={null}
                locale="es"
                currentPath="/es/"
                adminPanelUrl="https://admin.test"
            />
        );
        expect(screen.getByRole('link', { name: /iniciar sesión/i })).toBeInTheDocument();
    });

    it('the sign-in link points to /{locale}/auth/signin/', () => {
        render(
            <UserMenu
                initialUser={null}
                locale="en"
                currentPath="/en/"
                adminPanelUrl="https://admin.test"
            />
        );
        const link = screen.getByRole('link', { name: /sign in/i });
        expect(link).toHaveAttribute('href', '/en/auth/signin/');
    });
});

describe('UserMenu — authenticated render', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    actor: {
                        id: 'user-1',
                        name: 'Carlos Ramírez',
                        email: 'carlos@example.com',
                        permissions: []
                    },
                    isAuthenticated: true
                }
            })
        }) as unknown as typeof fetch;
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it('renders an avatar trigger button', () => {
        renderMenu();
        expect(screen.getByRole('button', { name: /abrir menú de cuenta/i })).toBeInTheDocument();
    });

    it('renders initials when no avatarUrl is set', () => {
        renderMenu();
        expect(screen.getByText('CR')).toBeInTheDocument();
    });

    it('opens the dropdown when the trigger is clicked', () => {
        renderMenu();
        open();
        expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('closes the dropdown when Escape is pressed', () => {
        renderMenu();
        open();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('shows always-on items (dashboard, favorites, messages, reviews, subscription, preferences)', () => {
        renderMenu();
        open();
        expect(screen.getByRole('menuitem', { name: /mi cuenta/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /mis favoritos/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /mis mensajes/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /mis reseñas/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /mi suscripción/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /preferencias/i })).toBeInTheDocument();
    });
});

describe('UserMenu — permission-gated items', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it('hides "Mis alojamientos" while permissions are loading', () => {
        global.fetch = vi.fn(
            () =>
                new Promise(() => {
                    // Never resolves — simulates pending /auth/me
                })
        ) as unknown as typeof fetch;
        renderMenu();
        open();
        expect(
            screen.queryByRole('menuitem', { name: /mis alojamientos/i })
        ).not.toBeInTheDocument();
    });

    it('shows "Mis alojamientos" for users with accommodation.create permission', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'user-1', name: 'Carlos', email: 'c@e.com' },
                permissions: ['accommodation.create'],
                cachedAt: Date.now()
            })
        );
        renderMenu();
        await waitFor(() => {
            open();
            expect(screen.getByRole('menuitem', { name: /mis alojamientos/i })).toBeInTheDocument();
        });
    });

    it('shows "Panel de administración" for users with access.panelAdmin', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'user-1', name: 'Admin', email: 'a@e.com' },
                permissions: ['access.panelAdmin'],
                cachedAt: Date.now()
            })
        );
        renderMenu();
        await waitFor(() => {
            open();
            const adminLink = screen.getByRole('menuitem', {
                name: /panel de administración/i
            });
            expect(adminLink).toBeInTheDocument();
            expect(adminLink).toHaveAttribute('href', 'https://admin.test');
            expect(adminLink).toHaveAttribute('target', '_blank');
        });
    });

    it('does NOT show admin panel link for users without the permission', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'user-1', name: 'User', email: 'u@e.com' },
                permissions: ['accommodation.create'],
                cachedAt: Date.now()
            })
        );
        renderMenu();
        await waitFor(() => {
            open();
            expect(
                screen.queryByRole('menuitem', { name: /panel de administración/i })
            ).not.toBeInTheDocument();
        });
    });
});

describe('UserMenu — sign out', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    actor: { id: 'user-1', permissions: [] },
                    isAuthenticated: true
                }
            })
        }) as unknown as typeof fetch;
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('calls signOut when "Cerrar sesión" is clicked', async () => {
        renderMenu();
        open();
        const signOutBtn = screen.getByRole('menuitem', { name: /cerrar sesión/i });
        fireEvent.click(signOutBtn);
        await waitFor(() => {
            expect(signOut).toHaveBeenCalled();
        });
    });
});
