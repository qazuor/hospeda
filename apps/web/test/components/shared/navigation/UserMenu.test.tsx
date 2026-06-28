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

    it('shows always-on items (dashboard, favorites, messages, reviews, subscription, newsletter, preferences)', () => {
        renderMenu();
        open();
        expect(screen.getByRole('menuitem', { name: /mi cuenta/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /mis favoritos/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /mis consultas/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /mis reseñas/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /mi suscripción/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /boletín de novedades/i })).toBeInTheDocument();
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

    it('shows "Modo anfitrión" for HOST users (access.panelAdmin without access.apiAdmin)', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'user-1', name: 'Host', email: 'h@e.com' },
                permissions: ['access.panelAdmin'],
                cachedAt: Date.now()
            })
        );
        renderMenu();
        await waitFor(() => {
            open();
            const adminLink = screen.getByRole('menuitem', {
                name: /modo anfitrión/i
            });
            expect(adminLink).toBeInTheDocument();
            expect(adminLink).toHaveAttribute('href', 'https://admin.test');
            expect(adminLink).toHaveAttribute('target', '_blank');
        });
    });

    it('shows "Panel de administración" for platform staff (access.apiAdmin present)', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'user-1', name: 'Admin', email: 'a@e.com' },
                permissions: ['access.panelAdmin', 'access.apiAdmin'],
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
            // The host-mode label MUST NOT show for staff.
            expect(
                screen.queryByRole('menuitem', { name: /modo anfitrión/i })
            ).not.toBeInTheDocument();
        });
    });

    it('does NOT show admin panel link for users without access.panelAdmin', async () => {
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
            expect(
                screen.queryByRole('menuitem', { name: /modo anfitrión/i })
            ).not.toBeInTheDocument();
        });
    });
});

describe('UserMenu — TTL guard (rate-limit fix)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it('does NOT call fetch when the sessionStorage cache is still within the 60s TTL', async () => {
        // Simulate the scenario: page was loaded, /auth/me was fetched and cached,
        // then a View Transition navigation remounts UserMenu within the TTL window.
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'u1', name: 'Test User', email: 'test@example.com' },
                permissions: [],
                cachedAt: Date.now() // just written — definitely fresh
            })
        );

        const fetchMock = vi.fn();
        global.fetch = fetchMock as unknown as typeof fetch;

        renderMenu();

        // Give effects time to flush
        await new Promise<void>((resolve) => setTimeout(resolve, 50));

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('applies the cached auth state immediately without fetching', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'u1', name: 'Cached User', email: 'cached@example.com' },
                permissions: ['accommodation.create'],
                cachedAt: Date.now()
            })
        );

        const fetchMock = vi.fn();
        global.fetch = fetchMock as unknown as typeof fetch;

        renderMenu({
            initialUser: { id: 'u1', name: 'Cached User', email: 'cached@example.com' }
        });

        // Permission-gated item should appear from the cached permissions
        // without waiting for any network call.
        const trigger = screen.getByRole('button', { name: /abrir menú de cuenta/i });
        fireEvent.click(trigger);
        await waitFor(() => {
            expect(screen.getByRole('menuitem', { name: /mis alojamientos/i })).toBeInTheDocument();
        });

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fetches (ignores cache) when a fresh GUEST cache contradicts an authenticated SSR user', async () => {
        // Post-sign-in regression: user browsed as guest (guest snapshot cached),
        // then signed in via OAuth (full reload). sessionStorage survives the reload,
        // so the fresh guest cache must NOT overwrite the authenticated initialUser the
        // SSR now provides — the guard has to discard the mismatched cache and refetch.
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: false,
                user: null,
                permissions: [],
                cachedAt: Date.now() // fresh guest cache, well within the 60s TTL
            })
        );

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    actor: {
                        id: 'u1',
                        name: 'Test User',
                        email: 'test@example.com',
                        permissions: []
                    },
                    isAuthenticated: true
                }
            })
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        // renderMenu default passes initialUser=MOCK_USER (authenticated).
        renderMenu();

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    it('fetches (ignores cache) when a fresh AUTHENTICATED cache contradicts a guest SSR user', async () => {
        // Reverse (post-sign-out) regression: a stale authenticated cache must not
        // keep showing the avatar after the SSR reports a guest session.
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'u1', name: 'Stale User', email: 'stale@example.com' },
                permissions: [],
                cachedAt: Date.now()
            })
        );

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: { actor: null, isAuthenticated: false }
            })
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        renderMenu({ initialUser: null });

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    it('calls fetch when the cache is absent (first page load / cache cleared)', async () => {
        // No sessionStorage entry — simulates a fresh page load or post-signout.
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    actor: {
                        id: 'u1',
                        name: 'Fresh User',
                        email: 'fresh@example.com',
                        permissions: []
                    },
                    isAuthenticated: true
                }
            })
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        renderMenu();

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    it('calls fetch when the cache is expired (older than 60s TTL)', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'u1', name: 'Old User', email: 'old@example.com' },
                permissions: [],
                cachedAt: Date.now() - 65_000 // 65 seconds ago — past the 60s TTL
            })
        );

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    actor: {
                        id: 'u1',
                        name: 'Old User',
                        email: 'old@example.com',
                        permissions: []
                    },
                    isAuthenticated: true
                }
            })
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        renderMenu();

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
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
