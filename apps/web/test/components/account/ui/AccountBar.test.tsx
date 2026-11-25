import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AccountBar } from '../../../../src/components/account/ui/AccountBar';
import { buildSidebarView } from '../../../../src/components/account/ui/account-sidebar-view';
import { buildAccountNavModel } from '../../../../src/lib/account-nav-model';

function viewFor(activeSection: string) {
    return buildSidebarView({
        model: buildAccountNavModel({
            roles: null,
            permissions: ['accommodation.create'],
            ownsHostTradeListing: false,
            mcpEnabled: false,
            activeSection
        }),
        locale: 'es'
    });
}

describe('AccountBar minimal crumb', () => {
    it('links to the account root and renders the current section as plain text, without controls', () => {
        const { container } = render(
            <AccountBar
                view={viewFor('editar')}
                locale="es"
            />
        );
        expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/'
        );
        expect(container).toHaveTextContent('Mi cuenta / Editar perfil');
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(container.querySelectorAll('a')).toHaveLength(1);
    });

    it.each(['Mi cuenta', undefined])('does not repeat the account root (%s)', (pageTitle) => {
        const { container } = render(
            <AccountBar
                view={viewFor('mi-cuenta')}
                locale="es"
                pageTitle={pageTitle}
            />
        );
        expect(container.textContent).toBe('Mi cuenta');
    });

    it('uses the page title when the registry has no active entry', () => {
        const { container } = render(
            <AccountBar
                view={viewFor('unknown')}
                locale="es"
                pageTitle="New listing"
            />
        );
        expect(container).toHaveTextContent('Mi cuenta / New listing');
    });
});
