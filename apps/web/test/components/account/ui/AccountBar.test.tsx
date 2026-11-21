/**
 * Tests for AccountBar (HOS-2413 T-021).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
    AccountBar,
    AccountSidebar,
    buildSidebarView
} from '../../../../src/components/account/ui';
import { buildAccountNavModel } from '../../../../src/lib/account-nav-model';

const model = buildAccountNavModel({
    roles: ['HOST'],
    ownsHostTradeListing: false,
    mcpEnabled: true,
    activeSection: 'editar'
});
const view = buildSidebarView({ model, locale: 'es' });

describe('AccountBar', () => {
    it('shows the menu label and the current section', () => {
        render(
            <AccountBar
                view={view}
                locale="es"
            />
        );
        const toggle = screen.getByRole('button', { name: /Mi cuenta/ });
        expect(toggle).toHaveTextContent(view.activeLabel);
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(toggle).toHaveAttribute('aria-controls');
    });

    it('opens the drawer, closes on Escape and returns focus to the button', async () => {
        const user = userEvent.setup();
        render(
            <AccountBar
                view={view}
                locale="es"
            />
        );
        const toggle = screen.getByRole('button', { name: /Mi cuenta/ });
        toggle.focus();
        await user.click(toggle);
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(toggle).toHaveFocus();
    });

    it('closes when a link inside the drawer is chosen (soft navigation keeps the DOM)', async () => {
        const user = userEvent.setup();
        render(
            <AccountBar
                view={view}
                locale="es"
            />
        );
        await user.click(screen.getByRole('button', { name: /Mi cuenta/ }));
        const dialog = await screen.findByRole('dialog');
        const link = dialog.querySelector('a') as HTMLAnchorElement;
        link.addEventListener('click', (event) => event.preventDefault());
        await user.click(link);
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('lists the same groups in the drawer as the sidebar does for the same view', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <>
                <AccountSidebar
                    view={view}
                    locale="es"
                />
                <AccountBar
                    view={view}
                    locale="es"
                />
            </>
        );
        await user.click(screen.getByRole('button', { name: /Mi cuenta/ }));
        const dialog = await screen.findByRole('dialog');
        const sidebarGroups = [
            ...container
                .querySelectorAll('[data-account-sidebar]')[0]
                .querySelectorAll('[data-nav-group]')
        ].map((el) => el.getAttribute('data-nav-group'));
        const drawerGroups = [...dialog.querySelectorAll('[data-nav-group]')].map((el) =>
            el.getAttribute('data-nav-group')
        );
        expect(drawerGroups).toEqual(sidebarGroups);
        expect(drawerGroups.length).toBeGreaterThan(0);
    });
});
