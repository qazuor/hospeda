/**
 * @file UserMenu.test.tsx
 * @description Tests the rebuilt navbar user menu with role-aware items.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    UserMenuProps,
    UserMenuUser
} from '../../../../src/components/shared/navigation/UserMenu.client';
import { UserMenu } from '../../../../src/components/shared/navigation/UserMenu.client';
import {
    identifyUser,
    markVisitorAnonymous,
    resetUser,
    setPersonProperties
} from '../../../../src/lib/analytics/umami-client';
import { AUTH_ME_CACHE_KEY } from '../../../../src/lib/auth-cache';
import { signOut } from '../../../../src/lib/auth-client';

vi.mock('../../../../src/lib/auth-client', () => ({
    signOut: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../../src/lib/analytics/umami-client', () => ({
    identifyUser: vi.fn(),
    markVisitorAnonymous: vi.fn(),
    resetUser: vi.fn(),
    setPersonProperties: vi.fn()
}));

// The plan/tier sync fires its own protected fetch on mount; mock it so it
// doesn't interfere with the /auth/me fetch assertions in this suite.

vi.mock('../../../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.test',
    isLoggingEnabled: () => false
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

    it('a pure tourist sees four ordered quick links, preferences and sign-out', async () => {
        renderMenu({});
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        open();
        expect(screen.getByRole('menuitem', { name: /^mi cuenta$/i })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/'
        );
        expect(screen.getAllByRole('menuitem').map((item) => item.textContent?.trim())).toEqual([
            'Mi cuenta',
            'Editar perfil',
            'Favoritos',
            'Suscripción',
            'Cerrar sesión'
        ]);
        expect(screen.queryByText('Administración')).not.toBeInTheDocument();
        const row = screen.getByText('Preferencias').parentElement;
        expect(row).not.toBeNull();
        if (!row) throw new Error('Missing preferences row');
        expect(within(row).getByRole('group', { name: 'Cambiar idioma' })).toBeInTheDocument();
        expect(within(row).getByRole('group', { name: 'Tema' })).toBeInTheDocument();
        expect(screen.queryByText('Idioma')).not.toBeInTheDocument();
        expect(screen.queryByText('Tema')).not.toBeInTheDocument();

        // jsdom does not lay out CSS modules. Pin the space for both control groups.
        const css = readFileSync(
            resolve(__dirname, '../../../../src/components/shared/navigation/UserMenu.module.css'),
            'utf8'
        );
        expect(css).toMatch(
            /\.menu\s*\{[^}]*\bwidth: min\(24rem, calc\(100vw - var\(--space-8\)\)\);/
        );
    });

    it('keeps preferences, newsletter and AI assistants in the full account menu only', async () => {
        renderMenu();
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        open();
        for (const name of [/^preferencias$/i, /boletín de novedades/i, /asistentes de ia/i]) {
            expect(screen.queryByRole('menuitem', { name })).not.toBeInTheDocument();
        }
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

    it('hides every «Administrar …» shortcut while permissions are loading', () => {
        global.fetch = vi.fn(
            () =>
                new Promise(() => {
                    // Never resolves — simulates pending /auth/me
                })
        ) as unknown as typeof fetch;
        renderMenu();
        open();
        expect(screen.queryByText('Administración')).not.toBeInTheDocument();
        expect(
            screen.queryByRole('menuitem', { name: /administrar alojamientos/i })
        ).not.toBeInTheDocument();
    });

    it('lists one «Administrar …» shortcut per vertical under «Administración» (HOS-2551)', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'user-1', name: 'Carlos', email: 'c@e.com' },
                permissions: [
                    'accommodation.create',
                    'venue.editOwn',
                    'experience.editOwn',
                    'post.create'
                ],
                roles: ['USER', 'HOST', 'VENUE_OWNER', 'EXPERIENCE_OWNER', 'EDITOR'],
                ownsHostTradeListing: true,
                cachedAt: Date.now()
            })
        );
        renderMenu();
        await waitFor(() => {
            open();
            expect(screen.getByRole('group', { name: 'Administración' })).toBeInTheDocument();
        });
        const group = screen.getByRole('group', { name: 'Administración' });
        expect(
            screen
                .getAllByRole('menuitem')
                .slice(0, 4)
                .map((item) => item.textContent?.trim())
        ).toEqual(['Mi cuenta', 'Editar perfil', 'Favoritos', 'Suscripción']);
        const links = [...group.querySelectorAll('a')].map((link) => [
            link.textContent?.trim(),
            link.getAttribute('href')
        ]);
        expect(links).toEqual([
            ['Administrar alojamientos', '/es/mi-cuenta/host-dashboard/'],
            ['Administrar Comer y salir', '/es/mi-cuenta/comercio/?vertical=venue'],
            ['Administrar experiencias', '/es/mi-cuenta/comercio/?vertical=experience'],
            ['Administrar contenido editorial', '/es/mi-cuenta/publicaciones/'],
            ['Administrar ficha de proveedor', '/es/mi-cuenta/proveedor/']
        ]);
    });

    it('shows «Administrar ficha de aliado» when the cache says the account owns a partner (HOS-2551)', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'user-1', name: 'Carlos', email: 'c@e.com' },
                permissions: [],
                roles: ['USER'],
                ownsPartner: true,
                cachedAt: Date.now()
            })
        );
        renderMenu();
        // Open ONCE: `open()` toggles, so clicking it inside a retry loop can
        // stall instead of failing when the shortcut is missing.
        open();
        const group = await screen.findByRole('group', { name: 'Administración' });
        const links = [...group.querySelectorAll('a')].map((link) => [
            link.textContent?.trim(),
            link.getAttribute('href')
        ]);
        expect(links).toEqual([['Administrar ficha de aliado', '/es/mi-cuenta/partner/']]);
    });

    it('shows only «Administrar experiencias» for an experience-only owner', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'user-1', name: 'Carlos', email: 'c@e.com' },
                permissions: ['experience.editOwn'],
                roles: ['USER', 'EXPERIENCE_OWNER'],
                cachedAt: Date.now()
            })
        );
        renderMenu();
        await waitFor(() => {
            open();
            expect(
                screen.getByRole('menuitem', { name: /administrar experiencias/i })
            ).toBeInTheDocument();
        });
        expect(
            screen.queryByRole('menuitem', { name: /administrar comer y salir/i })
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('menuitem', { name: /administrar alojamientos/i })
        ).not.toBeInTheDocument();
    });

    it('shows "Modo anfitrión" for HOST users (access.panelAdmin without access.apiAdmin)', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'user-1', name: 'Host', email: 'h@e.com' },
                permissions: ['access.panelAdmin'],
                roles: ['USER', 'ADMIN'],
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
                roles: ['USER'],
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
                roles: ['USER', 'HOST'],
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
                roles: [],
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
                permissions: ['accommodation.create', 'access.panelAdmin'],
                roles: ['USER', 'HOST'],
                cachedAt: Date.now()
            })
        );

        const fetchMock = vi.fn();
        global.fetch = fetchMock as unknown as typeof fetch;

        renderMenu({
            initialUser: { id: 'u1', name: 'Cached User', email: 'cached@example.com' }
        });

        // Permission-gated item (the admin-panel link) should appear from the
        // cached permissions without waiting for any network call.
        const trigger = screen.getByRole('button', { name: /abrir menú de cuenta/i });
        fireEvent.click(trigger);
        await waitFor(() => {
            expect(screen.getByRole('menuitem', { name: /modo anfitrión/i })).toBeInTheDocument();
        });

        // The rate-limit guard is about the auth round-trip: no /auth/me call.
        // Opening the menu may load the tourist plan line (HOS-2649).
        const authCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/me'));
        expect(authCalls).toHaveLength(0);
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
                roles: [],
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
                roles: [],
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
                roles: [],
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

    it('clears the theme sync marker when signing out (HOS-1988)', async () => {
        // Arrange: this tab already synced the saved theme for the user.
        sessionStorage.setItem('themeSyncedFor', 'user-1');
        renderMenu();
        open();

        // Act
        fireEvent.click(screen.getByRole('menuitem', { name: /cerrar sesión/i }));

        // Assert
        await waitFor(() => expect(signOut).toHaveBeenCalled());
        expect(sessionStorage.getItem('themeSyncedFor')).toBeNull();
    });

    it('drops the /auth/me snapshot before signing out (HOS-1206)', async () => {
        // Arrange: the island has resolved and cached the authenticated user.
        renderMenu();
        await waitFor(() => expect(sessionStorage.getItem(AUTH_ME_CACHE_KEY)).not.toBeNull());
        let snapshotAtSignOut: string | null = 'not-called';
        vi.mocked(signOut).mockImplementationOnce(async () => {
            snapshotAtSignOut = sessionStorage.getItem(AUTH_ME_CACHE_KEY);
            return undefined as never;
        });

        // Act
        open();
        fireEvent.click(screen.getByRole('menuitem', { name: /cerrar sesión/i }));

        // Assert
        await waitFor(() => expect(signOut).toHaveBeenCalled());
        expect(snapshotAtSignOut).toBeNull();
    });

    it('still signs out when sessionStorage throws (HOS-1206)', async () => {
        // The former bare `removeItem` sat inside the try with no catch: a
        // throwing storage skipped `signOut()` and redirected home signed IN.
        renderMenu();
        vi.mocked(signOut).mockClear();
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });

        open();
        fireEvent.click(screen.getByRole('menuitem', { name: /cerrar sesión/i }));

        await waitFor(() => expect(signOut).toHaveBeenCalled());
    });
});

describe('UserMenu — Umami identify/reset', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: { actor: { id: 'user-1', permissions: [] }, isAuthenticated: true }
            })
        }) as unknown as typeof fetch;
        sessionStorage.clear();
        // handleSignOut assigns window.location.href — jsdom blocks direct
        // assignment, so stub it like other suites that exercise sign-out.
        Object.defineProperty(window, 'location', {
            value: { href: '' },
            writable: true,
            configurable: true
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it('calls identifyUser with the resolved user id when authenticated', async () => {
        renderMenu();
        await waitFor(() => {
            expect(identifyUser).toHaveBeenCalledWith('user-1', expect.any(Object));
        });
    });

    it('attaches segment person properties once permissions resolve', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    actor: {
                        id: 'user-1',
                        roles: ['USER', 'HOST', 'VENUE_OWNER'],
                        permissions: ['accommodation.create', 'venue.editOwn']
                    },
                    isAuthenticated: true
                }
            })
        }) as unknown as typeof fetch;

        renderMenu();

        await waitFor(() => {
            expect(identifyUser).toHaveBeenLastCalledWith('user-1', {
                // HOS-296: an ARRAY person property, sorted for stability.
                // A multi-hat user reports every hat AND both segment
                // booleans — under the old scalar only one could be true.
                roles: ['HOST', 'USER', 'VENUE_OWNER'],
                user_type: 'owner',
                is_host: true,
                is_venue_owner: true,
                is_experience_owner: false,
                is_staff: false
            });
        });
    });

    it('marks an experience-only owner via is_experience_owner', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    actor: {
                        id: 'user-1',
                        roles: ['USER', 'EXPERIENCE_OWNER'],
                        permissions: ['experience.editOwn']
                    },
                    isAuthenticated: true
                }
            })
        }) as unknown as typeof fetch;

        renderMenu();
        await waitFor(() => {
            expect(identifyUser).toHaveBeenLastCalledWith(
                'user-1',
                expect.objectContaining({
                    is_venue_owner: false,
                    is_experience_owner: true,
                    user_type: 'owner'
                })
            );
        });
    });

    it('marks platform staff via is_staff when access.apiAdmin is present', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    actor: {
                        id: 'user-1',
                        roles: ['USER', 'ADMIN'],
                        permissions: ['access.panelAdmin', 'access.apiAdmin']
                    },
                    isAuthenticated: true
                }
            })
        }) as unknown as typeof fetch;

        renderMenu();

        await waitFor(() => {
            expect(identifyUser).toHaveBeenLastCalledWith('user-1', {
                roles: ['ADMIN', 'USER'],
                user_type: 'staff',
                is_host: false,
                is_venue_owner: false,
                is_experience_owner: false,
                is_staff: true
            });
        });
    });

    it('does NOT call identifyUser when the visitor is a guest', () => {
        render(
            <UserMenu
                initialUser={null}
                locale="es"
                currentPath="/es/"
                adminPanelUrl="https://admin.test"
            />
        );
        expect(identifyUser).not.toHaveBeenCalled();
    });

    it('declares a resolved guest anonymous so the first pageview is released', async () => {
        // Arrange
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { actor: null, isAuthenticated: false } })
        }) as unknown as typeof fetch;

        // Act
        render(
            <UserMenu
                initialUser={null}
                locale="es"
                currentPath="/es/"
                adminPanelUrl="https://admin.test"
            />
        );

        // Assert
        await waitFor(() => expect(markVisitorAnonymous).toHaveBeenCalledTimes(1));
        expect(identifyUser).not.toHaveBeenCalled();
    });

    it('does NOT declare a guest from the SSR hint alone (SSG pages pass null for everyone)', async () => {
        // Arrange: SSG page, the visitor is in fact logged in
        render(
            <UserMenu
                initialUser={null}
                locale="es"
                currentPath="/es/"
                adminPanelUrl="https://admin.test"
            />
        );

        // Act: /auth/me answers with the user
        await waitFor(() =>
            expect(identifyUser).toHaveBeenCalledWith('user-1', expect.any(Object))
        );

        // Assert
        expect(markVisitorAnonymous).not.toHaveBeenCalled();
    });

    it('sets the locale person property for an authenticated visitor', async () => {
        renderMenu();
        await waitFor(() => {
            expect(setPersonProperties).toHaveBeenCalledWith({ locale: 'es' });
        });
    });

    it('does not sync removed plan person properties', async () => {
        renderMenu();
        await waitFor(() => expect(setPersonProperties).toHaveBeenCalled());
        expect(setPersonProperties).not.toHaveBeenCalledWith(
            expect.objectContaining({ plan: expect.anything() })
        );
    });

    it('does NOT set person properties for a guest', () => {
        render(
            <UserMenu
                initialUser={null}
                locale="es"
                currentPath="/es/"
                adminPanelUrl="https://admin.test"
            />
        );
        expect(setPersonProperties).not.toHaveBeenCalled();
    });

    it('calls resetUser when "Cerrar sesión" is clicked', async () => {
        renderMenu();
        open();
        const signOutBtn = screen.getByRole('menuitem', { name: /cerrar sesión/i });
        fireEvent.click(signOutBtn);
        await waitFor(() => {
            expect(resetUser).toHaveBeenCalled();
        });
    });
});
