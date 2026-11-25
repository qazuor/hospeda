/** Site-to-account handoff, with real menu and sheet rendering. */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountSheet } from '../../../../src/components/shared/navigation/AccountSheet.client';
import { MobileMenu } from '../../../../src/components/shared/navigation/MobileMenu.client';
import { onOpenAccountSheet } from '../../../../src/lib/account-sheet-events';

const calls = vi.hoisted(() => ({ order: [] as string[] }));
const user = { id: 'u1', name: 'Ana García', email: 'ana@example.com' };
vi.mock('../../../../src/hooks/use-account-permissions', () => ({
    useAccountPermissions: () => ({
        user,
        permissions: ['accommodation.create', 'access.panelAdmin', 'access.apiAdmin'],
        roles: [],
        ownsHostTradeListing: false,
        ownsPartner: false
    })
}));
vi.mock('../../../../src/lib/dialog-history', async (original) => ({
    ...(await original<typeof import('../../../../src/lib/dialog-history')>()),
    acquireDialogHistoryEntry: () => {
        calls.order.push('acquire');
        return { release: () => calls.order.push('release') };
    }
}));
vi.mock('astro:transitions/client', () => ({ navigate: vi.fn() }));
vi.mock('../../../../src/components/shared/preferences/LanguageSwitcher.client', () => ({
    LanguageSwitcher: () => null
}));
vi.mock('../../../../src/components/shared/preferences/ThemeControl.client', () => ({
    ThemeControl: () => null
}));

function setup() {
    render(
        <>
            <MobileMenu
                locale="es"
                navItems={[{ label: 'Destinations', href: '/es/destinos/' }]}
                currentPath="/es/"
                logoSrc="/logo.webp"
                homeHref="/es/"
                initialUser={user}
                initialRoles={[]}
                adminPanelUrl="https://admin.test"
            />
            <AccountSheet
                locale="es"
                adminPanelUrl="https://admin.test"
            />
        </>
    );
    act(() => window.dispatchEvent(new CustomEvent('mobile-menu:toggle')));
}

describe('MobileMenu account handoff', () => {
    beforeEach(() => {
        calls.order.length = 0;
    });
    it('shows one account row, no curated accordion, no sign-out and no staff link in the hamburger', () => {
        setup();
        const menu = screen.getByRole('dialog');
        const row = within(menu).getByRole('button', { name: /Mi cuenta Ana García/ });
        expect(row).toHaveAttribute('aria-haspopup', 'dialog');
        expect(row).not.toHaveAttribute('aria-expanded');
        expect(
            within(menu).queryByRole('link', {
                name: /Mi cuenta|Favoritos|Administrar|Panel de administración/
            })
        ).toBeNull();
        expect(within(menu).queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
        expect(within(menu).getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
    });
    it('unwinds hamburger history and releases scroll lock BEFORE opening the account sheet', async () => {
        setup();
        const observed = vi.fn(() => {
            calls.order.push('open-event');
            expect(document.documentElement).not.toHaveAttribute('data-mobile-menu-open');
            expect(document.documentElement.style.overflow).not.toBe('hidden');
        });
        const cleanup = onOpenAccountSheet(observed);
        fireEvent.click(screen.getByRole('button', { name: /Mi cuenta Ana García/ }));
        expect(calls.order).toEqual(['acquire', 'release']);
        expect(observed).not.toHaveBeenCalled();
        act(() => window.dispatchEvent(new PopStateEvent('popstate')));
        await waitFor(() =>
            expect(screen.getByRole('dialog', { name: 'Menú de cuenta' })).toBeInTheDocument()
        );
        expect(calls.order).toEqual(['acquire', 'release', 'open-event', 'acquire']);
        expect(screen.getByRole('link', { name: /Panel de administración/ })).toHaveAttribute(
            'href',
            'https://admin.test'
        );
        expect(screen.getByRole('button', { name: 'Menú de cuenta' })).toHaveAttribute(
            'aria-expanded',
            'true'
        );
        cleanup();
    });
    it('opens exactly once through the bounded fallback if no popstate arrives', async () => {
        setup();
        const observed = vi.fn();
        const cleanup = onOpenAccountSheet(observed);
        fireEvent.click(screen.getByRole('button', { name: /Mi cuenta Ana García/ }));
        await waitFor(() => expect(observed).toHaveBeenCalledTimes(1));
        act(() => window.dispatchEvent(new PopStateEvent('popstate')));
        expect(observed).toHaveBeenCalledTimes(1);
        cleanup();
    });
});
