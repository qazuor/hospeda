/**
 * Tests for AccountSidebar and buildSidebarView (HOS-2413 T-019).
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AccountSidebar, buildSidebarView } from '../../../../src/components/account/ui';
import { buildAccountNavModel } from '../../../../src/lib/account-nav-model';

function viewFor(roles: readonly string[], activeSection = 'mi-cuenta') {
    return buildSidebarView({
        locale: 'es',
        model: buildAccountNavModel({
            roles,
            ownsHostTradeListing: false,
            mcpEnabled: true,
            activeSection
        })
    });
}

describe('AccountSidebar', () => {
    it('is a labelled nav with native details groups', () => {
        const { container } = render(
            <AccountSidebar
                view={viewFor(['HOST'])}
                locale="es"
            />
        );
        expect(
            screen.getByRole('navigation', { name: 'Navegación de Mi cuenta' })
        ).toBeInTheDocument();
        expect(container.querySelector('details > summary')).not.toBeNull();
    });

    it('opens the group that holds the active page and marks the item with aria-current', () => {
        const view = viewFor(['HOST', 'EDITOR'], 'propiedades');
        const { container } = render(
            <AccountSidebar
                view={view}
                locale="es"
            />
        );
        const current = container.querySelector('a[aria-current="page"]');
        expect(current).toHaveAttribute('href', '/es/mi-cuenta/propiedades/');
        const group = current?.closest('details');
        expect(group).toHaveAttribute('open');
        expect(group).toHaveAttribute('data-contains-active', 'true');
    });

    it('renders only the group holding the current page open (HOS-2549)', () => {
        const view = viewFor(['HOST', 'EDITOR'], 'favoritos');
        const { container } = render(
            <AccountSidebar
                view={view}
                locale="es"
            />
        );
        const open = [...container.querySelectorAll('details[open]')].map((el) =>
            el.getAttribute('data-nav-group')
        );
        const all = container.querySelectorAll('details[data-nav-group]').length;
        expect(all).toBeGreaterThan(1);
        expect(open).toEqual(['turista']);
        expect(container.querySelector('details[open]')).toHaveAttribute(
            'data-contains-active',
            'true'
        );
    });

    it.each([
        'publica',
        'aliados'
    ])('opens every titled personal group when the page %s matches no nav item (HOS-2551)', (section) => {
        const view = viewFor(['HOST'], section);
        const { container } = render(
            <AccountSidebar
                view={view}
                locale="es"
            />
        );
        const open = [...container.querySelectorAll('details[open]')].map((el) =>
            el.getAttribute('data-nav-group')
        );
        expect(open).toEqual(['perfil', 'turista']);
    });

    it('keeps a locked item as a link, with a lock and alternative text', () => {
        const view = viewFor(['USER']);
        const target = view.groups.flatMap((group) => group.items)[1];
        render(
            <AccountSidebar
                view={view}
                locale="es"
                lockedItemIds={new Set([target?.id ?? ''])}
            />
        );
        const link = screen.getByRole('link', { name: new RegExp(target?.label ?? '') });
        expect(link).toHaveAttribute('href', target?.href);
        expect(within(link).getByText('Requiere un plan superior')).toBeInTheDocument();
    });

    it('lists groups in the order of the model', () => {
        const view = viewFor(['HOST', 'VENUE_OWNER']);
        const { container } = render(
            <AccountSidebar
                view={view}
                locale="es"
            />
        );
        const order = [...container.querySelectorAll('[data-nav-group], ul')]
            .filter((el) => el.matches('[data-nav-group]'))
            .map((el) => el.getAttribute('data-nav-group'));
        expect(order).toEqual(
            view.groups.filter((group) => !group.suppressHeader).map((group) => group.id)
        );
    });

    it('renders the discovery doors on an area page', () => {
        const view = viewFor(['USER']);
        render(
            <AccountSidebar
                view={view}
                locale="es"
            />
        );
        expect(view.doors.length).toBeGreaterThan(0);
        for (const door of view.doors) {
            expect(screen.getByRole('link', { name: door.label })).toBeInTheDocument();
        }
    });

    it('slots the existing count-pill islands', () => {
        render(
            <AccountSidebar
                view={viewFor(['USER'], 'editar')}
                locale="es"
                whatsNewCount={<span data-testid="wn">3</span>}
            />
        );
        expect(screen.getByTestId('wn').closest('a')).toHaveAttribute(
            'href',
            expect.stringContaining('novedades')
        );
    });
});

describe('AccountSidebar: personal and business zones (HOS-2551)', () => {
    it('on a personal page shows Inicio, Mi perfil and Mis viajes, with no back link', () => {
        const { container } = render(
            <AccountSidebar
                view={viewFor(['HOST'], 'editar')}
                locale="es"
            />
        );
        const nav = container.querySelector('[data-account-sidebar]') as Element;
        expect(nav).toHaveAttribute('data-nav-mode', 'personal');
        expect(nav.querySelector('[data-back-link]')).toBeNull();
        const links = [...nav.querySelectorAll('a')];
        expect(links[0]).toHaveAttribute('href', '/es/mi-cuenta/');
        expect(links[0]).toHaveTextContent('Inicio');
        expect(screen.getByText('Mi perfil')).toBeInTheDocument();
        expect(screen.getByText('Mis viajes')).toBeInTheDocument();
        const hrefs = links.map((link) => link.getAttribute('href'));
        expect(hrefs).toContain('/es/mi-cuenta/asistentes-ia/');
        expect(hrefs).toContain('/es/mi-cuenta/favoritos/');
        expect(hrefs).not.toContain('/es/mi-cuenta/propiedades/');
    });

    it('on /mi-cuenta/ renders Mi perfil and Mis viajes open', () => {
        const { container } = render(
            <AccountSidebar
                view={viewFor(['HOST'], 'mi-cuenta')}
                locale="es"
            />
        );
        expect(
            [...container.querySelectorAll('details[open]')].map((el) =>
                el.getAttribute('data-nav-group')
            )
        ).toEqual(['perfil', 'turista']);
    });

    it('on a business page shows «← Mi cuenta» on top and only the verticals', () => {
        const { container } = render(
            <AccountSidebar
                view={viewFor(['HOST', 'EDITOR'], 'propiedades')}
                locale="es"
            />
        );
        const nav = container.querySelector('[data-account-sidebar]') as Element;
        expect(nav).toHaveAttribute('data-nav-mode', 'business');
        const links = [...nav.querySelectorAll('a')];
        expect(links[0]).toHaveAttribute('data-back-link');
        expect(links[0]).toHaveAttribute('href', '/es/mi-cuenta/');
        expect(links[0]).toHaveTextContent('Mi cuenta');
        const hrefs = links.map((link) => link.getAttribute('href'));
        expect(hrefs).not.toContain('/es/mi-cuenta/editar/');
        expect(hrefs).not.toContain('/es/mi-cuenta/favoritos/');
        expect(
            [...nav.querySelectorAll('details[data-nav-group]')].map((el) =>
                el.getAttribute('data-nav-group')
            )
        ).toEqual(['anfitrion', 'editorial']);
    });

    it('a pure tourist sees no AI assistants and no business vertical', () => {
        const { container } = render(
            <AccountSidebar
                view={viewFor(['USER'], 'mi-cuenta')}
                locale="es"
            />
        );
        const hrefs = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'));
        expect(hrefs).not.toContain('/es/mi-cuenta/asistentes-ia/');
        expect(hrefs).not.toContain('/es/mi-cuenta/host-dashboard/');
        expect(hrefs).toContain('/es/mi-cuenta/favoritos/');
    });
});

describe('buildSidebarView', () => {
    it('resolves labels and localized urls into plain data', () => {
        const view = viewFor(['USER']);
        expect(JSON.parse(JSON.stringify(view))).toEqual(view);
        expect(view.groups[0]?.items[0]?.href).toMatch(/^\/es\/mi-cuenta/);
        expect(view.activeLabel).toBeTruthy();
    });
});

describe('AccountSidebar — partner (HOS-2551)', () => {
    it('shows «Mi ficha de aliado» in the business zone when the account owns a partner', () => {
        const view = buildSidebarView({
            locale: 'es',
            model: buildAccountNavModel({
                roles: ['USER'],
                ownsHostTradeListing: false,
                ownsPartner: true,
                mcpEnabled: true,
                activeSection: 'partner'
            })
        });
        render(
            <AccountSidebar
                view={view}
                locale="es"
            />
        );
        expect(screen.getByRole('link', { name: /mi ficha de aliado/i })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/partner/'
        );
    });

    it('does not show it when the account owns no live partner', () => {
        const view = buildSidebarView({
            locale: 'es',
            model: buildAccountNavModel({
                roles: ['USER', 'HOST'],
                ownsHostTradeListing: false,
                ownsPartner: false,
                mcpEnabled: true,
                activeSection: 'propiedades'
            })
        });
        render(
            <AccountSidebar
                view={view}
                locale="es"
            />
        );
        expect(screen.queryByRole('link', { name: /mi ficha de aliado/i })).not.toBeInTheDocument();
    });
});
