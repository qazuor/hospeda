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
                view={viewFor(['USER'])}
                locale="es"
            />
        );
        expect(
            screen.getByRole('navigation', { name: 'Navegación de Mi cuenta' })
        ).toBeInTheDocument();
        expect(container.querySelector('details > summary')).not.toBeNull();
    });

    it('opens the group that holds the active page and marks the item with aria-current', () => {
        const view = viewFor(['USER'], 'editar');
        const { container } = render(
            <AccountSidebar
                view={view}
                locale="es"
            />
        );
        const current = container.querySelector('a[aria-current="page"]');
        expect(current).toHaveAttribute('href', '/es/mi-cuenta/editar/');
        const group = current?.closest('details');
        expect(group).toHaveAttribute('open');
        expect(group).toHaveAttribute('data-contains-active', 'true');
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

    it('renders the discovery doors and slots the existing count-pill islands', () => {
        const view = viewFor(['USER']);
        render(
            <AccountSidebar
                view={view}
                locale="es"
                whatsNewCount={<span data-testid="wn">3</span>}
            />
        );
        expect(screen.getByTestId('wn').closest('a')).toHaveAttribute(
            'href',
            expect.stringContaining('novedades')
        );
        for (const door of view.doors) {
            expect(screen.getByRole('link', { name: door.label })).toBeInTheDocument();
        }
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
