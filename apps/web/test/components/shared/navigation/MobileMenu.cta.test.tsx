/**
 * @file MobileMenu.cta.test.tsx
 * @description RTL tests for the mobile menu's "Publicar" submenu
 * (HOS-691) — a three-way chooser (accommodation / gastronomy /
 * experience), replacing the single owner CTA link this file used to test
 * (SPEC-182 D3 / HOS-311's host-mode-CTA swap between the `/publicar`
 * funnel and a "Modo anfitrión" shortcut).
 *
 * HOS-691 AC-12: the submenu renders unconditionally — for a guest, an
 * authenticated non-host, an existing HOST, AND an existing COMMERCE_OWNER
 * alike. There is no more per-role hiding or per-role destination swapping
 * to test here; that is the whole point of the rewrite (see the issue's
 * "Tests that break" section).
 *
 * HOS-691 AC-38: the three options (labels + hrefs) come from
 * `PUBLISH_CTA_OPTIONS` (`@/config/discovery-doors`) — the same source the
 * desktop header's `PublishMenu.client.tsx` uses.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileMenu } from '../../../../src/components/shared/navigation/MobileMenu.client';
import type { SupportedLocale } from '../../../../src/lib/i18n';

// ─── Module mocks ─────────────────────────────────────────────────────────────

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

vi.mock('../../../../src/lib/auth-client', () => ({
    signOut: vi.fn().mockResolvedValue(undefined),
    useSession: vi.fn(() => ({ data: null, isPending: true }))
}));

vi.mock('../../../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.test'
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
    locale: 'es' as SupportedLocale,
    navItems: [{ label: 'Inicio', href: '/es/' }],
    currentPath: '/es/',
    logoSrc: '/logo.svg',
    homeHref: '/es/',
    initialUser: null as { id: string; name: string; email: string } | null,
    initialRoles: [] as readonly string[],
    adminPanelUrl: 'https://admin.test'
};

function renderMenu(overrides: Partial<typeof DEFAULT_PROPS> = {}) {
    return render(
        <MobileMenu
            {...DEFAULT_PROPS}
            {...overrides}
        />
    );
}

function openMenu() {
    act(() => {
        window.dispatchEvent(new CustomEvent('mobile-menu:toggle'));
    });
}

function openPublishSubmenu() {
    const trigger = screen.getByRole('button', { name: /publicar/i });
    fireEvent.click(trigger);
    return trigger;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MobileMenu — "Publicar" submenu (HOS-691)', () => {
    beforeEach(() => {
        sessionStorage.clear();
        global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it('renders the closed "Publicar" trigger for a guest', () => {
        renderMenu();
        openMenu();

        const trigger = screen.getByRole('button', { name: /publicar/i });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('opens a role="menu" panel with exactly three options for a guest (AC-38)', () => {
        renderMenu();
        openMenu();
        openPublishSubmenu();

        expect(screen.getByRole('menu', { name: /publicar/i })).toBeInTheDocument();
        const items = screen.getAllByRole('menuitem');
        expect(items).toHaveLength(3);
    });

    it('links each option to its discovery-doors.ts href, locale-prefixed (AC-38)', () => {
        renderMenu();
        openMenu();
        openPublishSubmenu();

        expect(screen.getByRole('menuitem', { name: /alojamiento/i })).toHaveAttribute(
            'href',
            '/es/publicar/'
        );
        expect(screen.getByRole('menuitem', { name: /gastronomía/i })).toHaveAttribute(
            'href',
            '/es/publicar-restaurante/'
        );
        expect(screen.getByRole('menuitem', { name: /experiencias/i })).toHaveAttribute(
            'href',
            '/es/publicar-experiencia/'
        );
    });

    it('renders the submenu for an authenticated non-host role', () => {
        renderMenu({
            initialUser: { id: 'u1', name: 'Tourist', email: 'tourist@example.com' },
            initialRoles: ['USER']
        });
        openMenu();

        expect(screen.getByRole('button', { name: /publicar/i })).toBeInTheDocument();
    });

    it('renders the submenu for an existing HOST (HOS-691 AC-12 — the old hide/swap rule is gone)', () => {
        renderMenu({
            initialUser: { id: 'u1', name: 'Host User', email: 'host@example.com' },
            initialRoles: ['USER', 'HOST']
        });
        openMenu();
        openPublishSubmenu();

        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
        // No more "Modo anfitrión" shortcut — that behavior was removed with
        // the host-mode CTA swap.
        expect(screen.queryByRole('link', { name: /modo anfitrión/i })).not.toBeInTheDocument();
    });

    it('renders the submenu for an existing COMMERCE_OWNER (HOS-691 AC-12)', () => {
        renderMenu({
            initialUser: { id: 'u1', name: 'Commerce Owner', email: 'owner@example.com' },
            initialRoles: ['USER', 'COMMERCE_OWNER']
        });
        openMenu();
        openPublishSubmenu();

        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
    });

    it('renders the submenu for a user who is BOTH HOST and COMMERCE_OWNER', () => {
        renderMenu({
            initialUser: { id: 'u1', name: 'Host Merchant', email: 'both@example.com' },
            initialRoles: ['USER', 'COMMERCE_OWNER', 'HOST']
        });
        openMenu();
        openPublishSubmenu();

        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
    });

    it('clicking an option closes the submenu AND the whole overlay (same `onLinkClick` navigation path every other menu link uses)', () => {
        const { container } = renderMenu();
        openMenu();
        const trigger = openPublishSubmenu();

        fireEvent.click(screen.getByRole('menuitem', { name: /alojamiento/i }));

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        // Query the overlay by its stable role attribute directly — once
        // closed it is `aria-hidden="true"`, and RTL's accessible-name
        // computation for a hidden subtree is unreliable to assert on.
        const overlay = container.querySelector('[role="dialog"]');
        expect(overlay).toHaveAttribute('aria-hidden', 'true');
    });

    it('closes the submenu when clicking outside it (still inside the overlay)', () => {
        renderMenu();
        openMenu();
        const trigger = openPublishSubmenu();

        // `es` real translations resolve the nav's aria-label to
        // "Navegación principal".
        fireEvent.mouseDown(screen.getByRole('navigation', { name: /navegación principal/i }));

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('translates the trigger and option labels in en', () => {
        renderMenu({ locale: 'en' });
        openMenu();
        const trigger = screen.getByRole('button', { name: /^publish$/i });
        fireEvent.click(trigger);

        expect(screen.getByRole('menuitem', { name: /accommodation/i })).toHaveAttribute(
            'href',
            '/en/publicar/'
        );
    });

    it('collapses the submenu when the overlay itself closes', () => {
        renderMenu();
        openMenu();
        const trigger = openPublishSubmenu();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');

        // Close the whole overlay (second toggle event).
        openMenu();
        // Re-open to inspect the submenu's collapsed state without a stale
        // reference to the (possibly unmounted) trigger from before.
        openMenu();
        expect(screen.getByRole('button', { name: /publicar/i })).toHaveAttribute(
            'aria-expanded',
            'false'
        );
    });

    it('upgrades from the SSR guest hint once auth resolves a HOST — submenu stays present throughout', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    actor: {
                        id: 'u1',
                        name: 'Host User',
                        email: 'host@example.com',
                        roles: ['USER', 'HOST'],
                        permissions: ['accommodation.create']
                    },
                    isAuthenticated: true
                }
            })
        }) as unknown as typeof fetch;

        renderMenu({ initialUser: null, initialRoles: [] });
        openMenu();

        expect(screen.getByRole('button', { name: /publicar/i })).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /publicar/i })).toBeInTheDocument();
        });
    });
});
