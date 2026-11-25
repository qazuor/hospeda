import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountSheet } from '../../../../src/components/shared/navigation/AccountSheet.client';
import { buildAccountNavModel } from '../../../../src/lib/account-nav-model';
import { onOpenAccountSheet, openAccountSheet } from '../../../../src/lib/account-sheet-events';
import { buildUrl } from '../../../../src/lib/urls';

const mocks = vi.hoisted(() => ({
    user: {
        id: 'u1',
        name: 'Ana García',
        email: 'ana@example.com',
        avatarUrl: undefined as string | undefined
    } as { id: string; name: string; email: string; avatarUrl?: string } | null,
    permissions: ['accommodation.create', 'venue.editOwn'] as readonly string[] | null,
    ownsPartner: false,
    ownsHostTradeListing: false,
    signOut: vi.fn(),
    acquire: vi.fn(),
    release: vi.fn(),
    navigate: vi.fn()
}));
vi.mock('../../../../src/hooks/use-account-permissions', () => ({
    useAccountPermissions: () => mocks
}));
vi.mock('../../../../src/lib/sign-out', () => ({
    signOutAndClearClientState: () => mocks.signOut()
}));
vi.mock('../../../../src/lib/dialog-history', async (original) => ({
    ...(await original<typeof import('../../../../src/lib/dialog-history')>()),
    acquireDialogHistoryEntry: (params: { onPopped: () => void }) => {
        mocks.acquire(params);
        return { release: mocks.release };
    }
}));
vi.mock('astro:transitions/client', () => ({ navigate: (href: string) => mocks.navigate(href) }));

function renderSheet({ billingPresence }: { readonly billingPresence?: boolean } = {}) {
    return render(
        <AccountSheet
            locale="es"
            mcpEnabled
            billingPresence={billingPresence}
            adminPanelUrl="https://admin.test"
        />
    );
}
function open() {
    fireEvent.click(screen.getByRole('button', { name: 'Menú de cuenta' }));
}

describe('AccountSheet', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        window.history.replaceState({}, '', '/');
    });
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user = { id: 'u1', name: 'Ana García', email: 'ana@example.com' };
        mocks.permissions = ['accommodation.create', 'venue.editOwn'];
        mocks.ownsPartner = false;
        mocks.ownsHostTradeListing = false;
        mocks.signOut.mockResolvedValue({ ok: false });
    });

    it('renders nothing for a signed-out visitor, even after an open event', () => {
        mocks.user = null;
        const { container } = renderSheet();
        act(openAccountSheet);
        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('marks the active entry from the browser pathname', () => {
        window.history.replaceState({}, '', '/es/mi-cuenta/editar/');
        renderSheet();
        open();
        expect(screen.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute(
            'aria-current',
            'page'
        );
    });
    it.each([
        ['/es/mi-cuenta/propiedades/example-id/editar/', 'properties', 'anfitrion'],
        ['/es/mi-cuenta/propiedades/example-id/editar/fotos/', 'properties', 'anfitrion'],
        ['/es/mi-cuenta/comercio/?vertical=venue', 'venue-listings', 'comercio-venue'],
        [
            '/es/mi-cuenta/comercio/?vertical=experience',
            'experience-listings',
            'comercio-experience'
        ],
        [
            '/es/mi-cuenta/comercio/venue/example-id/editar/fotos/',
            'venue-listings',
            'comercio-venue'
        ],
        [
            '/es/mi-cuenta/comercio/experience/example-id/editar/?vertical=venue',
            'experience-listings',
            'comercio-experience'
        ],
        ['/es/mi-cuenta/publicaciones/example-id/editar/', 'myPosts', 'editorial'],
        ['/es/mi-cuenta/eventos/example-id/editar/', 'myEvents', 'editorial'],
        [
            '/es/mi-cuenta/directorio-proveedores/example-slug/registrar-uso/',
            'providerDirectory',
            'anfitrion'
        ],
        ['/es/mi-cuenta/consultas-propietario/conversation-id/', 'ownerMessages', 'anfitrion'],
        ['/es/mi-cuenta/favoritos/colecciones/collection-id/', 'favorites', 'turista'],
        ['/es/mi-cuenta/proveedor/editar/', 'provider', 'proveedor']
    ])('opens the parent group and highlights its registry item for %s', (pathname, itemId, groupId) => {
        // Arrange: make every candidate visible so a wrong sibling cannot pass unnoticed.
        mocks.permissions = [
            'accommodation.create',
            'venue.editOwn',
            'experience.editOwn',
            'post.create',
            'event.create',
            'hostTrade.view',
            'conversation.view.own'
        ];
        mocks.ownsHostTradeListing = true;
        window.history.replaceState({}, '', pathname);

        // Act: render the real sheet and its unchanged kit sidebar.
        renderSheet();
        open();

        // Assert: exactly the canonical parent item is current, in its open group.
        const dialog = screen.getByRole('dialog');
        const current = dialog.querySelectorAll('a[aria-current="page"]');
        const model = buildAccountNavModel({
            roles: null,
            permissions: mocks.permissions,
            ownsHostTradeListing: true,
            mcpEnabled: true,
            activeSection: ''
        });
        const group = model.groups.find((entry) => entry.group.id === groupId);
        const item = group?.items.find((entry) => entry.item.id === itemId)?.item;
        expect(item).toBeDefined();
        expect(current).toHaveLength(1);
        expect(current[0]).toHaveAttribute(
            'href',
            buildUrl({ locale: 'es', path: item?.href ?? '' })
        );
        if (group?.suppressHeader) {
            expect(current[0]?.closest('details')).toBeNull();
        } else {
            expect(current[0]?.closest('details')).toHaveAttribute('data-nav-group', groupId);
            expect(current[0]?.closest('details')).toHaveAttribute('open');
        }
    });
    it('does not open at the desktop breakpoint', () => {
        vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
            matches: true,
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => true
        }));
        renderSheet();
        open();
        act(openAccountSheet);
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(mocks.acquire).not.toHaveBeenCalled();
    });
    it('keeps event dispatch and subscriptions safe during SSR', () => {
        vi.stubGlobal('window', undefined);
        const listener = vi.fn();
        expect(() => {
            openAccountSheet();
            onOpenAccountSheet(listener)();
        }).not.toThrow();
        expect(listener).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });
    it('opens from its avatar trigger, renders identity and the complete ordered menu', async () => {
        renderSheet();
        open();
        const dialog = await screen.findByRole('dialog', { name: 'Menú de cuenta' });
        expect(within(dialog).getByText('Ana García')).toBeInTheDocument();
        expect(within(dialog).getByText('ana@example.com')).toBeInTheDocument();
        const summaries = [...dialog.querySelectorAll('summary')].map((element) =>
            element.textContent?.replace('▾', '')
        );
        expect(summaries).toEqual(['Área anfitrión', 'Comer y salir', 'Mi perfil', 'Mis viajes']);
        expect(dialog.querySelectorAll('[data-door]')).toHaveLength(1);
        expect(within(dialog).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/'
        );
        expect(mocks.acquire).toHaveBeenCalledTimes(1);
    });
    it('lists Complementos only for an account with a subscription (HOS-2627)', async () => {
        // Arrange + Act: no subscription (the fail-closed default)
        const { unmount } = renderSheet();
        open();
        const without = await screen.findByRole('dialog', { name: 'Menú de cuenta' });
        // Assert
        expect(within(without).queryByRole('link', { name: 'Complementos' })).toBeNull();
        unmount();

        // Arrange + Act: a subscription or active add-on
        renderSheet({ billingPresence: true });
        open();
        const withOne = await screen.findByRole('dialog', { name: 'Menú de cuenta' });
        // Assert
        expect(within(withOne).getByRole('link', { name: 'Complementos' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/complementos/'
        );
    });
    it('opens via event, closes on Escape and returns focus to the avatar', async () => {
        renderSheet();
        const trigger = screen.getByRole('button', { name: 'Menú de cuenta' });
        act(openAccountSheet);
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(trigger).toHaveFocus();
        expect(mocks.release).toHaveBeenCalledTimes(1);
    });
    it('closes on page swap and removes its event listener on unmount', async () => {
        const { unmount } = renderSheet();
        open();
        act(() => document.dispatchEvent(new Event('astro:before-swap')));
        expect(screen.queryByRole('dialog')).toBeNull();
        unmount();
        act(openAccountSheet);
        expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('closes and unwinds before navigating exactly once', async () => {
        renderSheet();
        open();
        fireEvent.click(
            within(await screen.findByRole('dialog')).getByRole('link', { name: 'Inicio' })
        );
        expect(mocks.release).toHaveBeenCalledTimes(1);
        expect(mocks.navigate).not.toHaveBeenCalled();
        act(() => window.dispatchEvent(new PopStateEvent('popstate')));
        await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
        expect(mocks.navigate).toHaveBeenCalledWith(expect.stringContaining('/es/mi-cuenta/'));
    });
    it('closes when browser back consumes its history entry', () => {
        renderSheet();
        open();
        act(() => mocks.acquire.mock.calls[0]?.[0].onPopped());
        expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('fails closed while permissions resolve and gates staff link with the existing permission rule', () => {
        mocks.permissions = null;
        const { unmount } = renderSheet();
        open();
        expect(screen.queryByRole('link', { name: /panel de administración/i })).toBeNull();
        expect(screen.queryByText('Área anfitrión')).toBeNull();
        unmount();
        mocks.permissions = ['access.panelAdmin', 'access.apiAdmin'];
        renderSheet();
        open();
        expect(screen.getByRole('link', { name: /panel de administración/i })).toHaveAttribute(
            'target',
            '_blank'
        );
        expect(
            fireEvent.click(screen.getByRole('link', { name: /panel de administración/i }))
        ).toBe(true);
        expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('shows an honest error when sign-out fails and keeps the account sheet open', async () => {
        renderSheet();
        open();
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cerrar tu sesión');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cerrar sesión' })).not.toBeDisabled();
    });
    it('disables sign-out while the request is pending', () => {
        mocks.signOut.mockReturnValue(new Promise(() => undefined));
        renderSheet();
        open();
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
        expect(screen.getByRole('button', { name: 'Cerrando sesión…' })).toBeDisabled();
    });
    it('reloads only after successful sign-out and history unwind', async () => {
        const reload = vi.fn();
        const originalWindow = window;
        const proxy = new Proxy(originalWindow, {
            get(target, key) {
                return key === 'location'
                    ? {
                          origin: originalWindow.location.origin,
                          pathname: originalWindow.location.pathname,
                          reload
                      }
                    : Reflect.get(target, key);
            }
        });
        renderSheet();
        open();
        mocks.signOut.mockResolvedValue({ ok: true });
        vi.stubGlobal('window', proxy);
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
        await waitFor(() => expect(mocks.release).toHaveBeenCalledTimes(1));
        expect(reload).not.toHaveBeenCalled();
        act(() => window.dispatchEvent(new PopStateEvent('popstate')));
        await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('supports image avatars and listener cleanup without a singleton', () => {
        mocks.user = { ...mocks.user!, avatarUrl: '/avatar.webp' };
        renderSheet();
        expect(
            screen.getByRole('button', { name: 'Menú de cuenta' }).querySelector('img')
        ).toHaveAttribute('src', '/avatar.webp');
        const listener = vi.fn();
        const cleanup = onOpenAccountSheet(listener);
        act(openAccountSheet);
        cleanup();
        act(openAccountSheet);
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
