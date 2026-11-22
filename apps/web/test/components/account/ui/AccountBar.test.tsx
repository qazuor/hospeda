/**
 * Tests for AccountBar (HOS-2413 T-021).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    AccountBar,
    AccountSidebar,
    buildSidebarView
} from '../../../../src/components/account/ui';
import { buildAccountNavModel } from '../../../../src/lib/account-nav-model';

vi.mock('astro:transitions/client', () => ({ navigate: () => Promise.resolve() }));

const aiState = vi.hoisted(() => ({ visible: false }));
vi.mock('../../../../src/hooks/use-ai-assistants-entry', () => ({
    useAiAssistantsEntry: () => aiState.visible
}));
vi.mock('../../../../src/components/shared/whats-new/WhatsNewCountPill.client', () => ({
    WhatsNewCountPill: () => <span data-testid="whats-new-pill">2</span>
}));
vi.mock('../../../../src/components/host/host-trades/BenefitUsagesCountPill.client', () => ({
    BenefitUsagesCountPill: () => <span data-testid="benefit-pill">1</span>
}));

const model = buildAccountNavModel({
    roles: ['HOST'],
    ownsHostTradeListing: false,
    mcpEnabled: false,
    activeSection: 'editar'
});
const view = buildSidebarView({ model, locale: 'es' });
const areasView = buildSidebarView({
    model: buildAccountNavModel({
        roles: ['HOST'],
        ownsHostTradeListing: false,
        mcpEnabled: false,
        activeSection: 'propiedades'
    }),
    locale: 'es'
});

/** Hrefs of every link inside a node, in order. */
const hrefsIn = (node: ParentNode) =>
    [...node.querySelectorAll('a')].map((anchor) => anchor.getAttribute('href'));

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

    it('closes when a link inside the drawer is chosen', async () => {
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
        await user.click(link);
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it.each([
        ['a personal page', view],
        ['an area page', areasView]
    ])('lists the same links in the drawer as the sidebar does on %s (HOS-2551)', async (_label, pageView) => {
        const user = userEvent.setup();
        const { container } = render(
            <>
                <AccountSidebar
                    view={pageView}
                    locale="es"
                />
                <AccountBar
                    view={pageView}
                    locale="es"
                />
            </>
        );
        await user.click(screen.getByRole('button', { name: /Mi cuenta/ }));
        const dialog = await screen.findByRole('dialog');
        const sidebar = container.querySelectorAll('[data-account-sidebar]')[0] as Element;
        const drawerLinks = hrefsIn(dialog);
        expect(drawerLinks).toEqual(hrefsIn(sidebar));
        expect(drawerLinks.length).toBeGreaterThan(0);
    });

    it('shows only the personal zone in the drawer on a personal page (HOS-2551)', async () => {
        const user = userEvent.setup();
        render(
            <AccountBar
                view={view}
                locale="es"
            />
        );
        await user.click(screen.getByRole('button', { name: /Mi cuenta/ }));
        const dialog = await screen.findByRole('dialog');
        expect(dialog.querySelector('[data-back-link]')).toBeNull();
        expect(hrefsIn(dialog)).toContain('/es/mi-cuenta/favoritos/');
        expect(hrefsIn(dialog)).not.toContain('/es/mi-cuenta/propiedades/');
    });

    it('shows «← Mi cuenta» and only the verticals in the drawer on a business page (HOS-2551)', async () => {
        const user = userEvent.setup();
        render(
            <AccountBar
                view={areasView}
                locale="es"
            />
        );
        await user.click(screen.getByRole('button', { name: /Mi cuenta/ }));
        const dialog = await screen.findByRole('dialog');
        expect(dialog.querySelector('[data-back-link]')).toHaveAttribute('href', '/es/mi-cuenta/');
        expect(hrefsIn(dialog)).toContain('/es/mi-cuenta/propiedades/');
        expect(hrefsIn(dialog)).not.toContain('/es/mi-cuenta/editar/');
    });

    it('points aria-controls at the drawer only while it is open', async () => {
        const user = userEvent.setup();
        render(
            <AccountBar
                view={view}
                locale="es"
            />
        );
        const toggle = screen.getByRole('button', { name: /Mi cuenta/ });
        expect(toggle).not.toHaveAttribute('aria-controls');
        await user.click(toggle);
        const dialog = await screen.findByRole('dialog');
        const target = toggle.getAttribute('aria-controls') ?? '';
        expect(dialog.querySelector(`#${target}`)).not.toBeNull();
    });

    it('gives the drawer copy the icons and the count pills of the desktop sidebar', async () => {
        const user = userEvent.setup();
        const { unmount } = render(
            <AccountBar
                view={areasView}
                locale="es"
            />
        );
        await user.click(screen.getByRole('button', { name: /Mi cuenta/ }));
        const dialog = await screen.findByRole('dialog');
        const firstEntry = dialog.querySelector('li a') as HTMLElement;
        expect(firstEntry.querySelector('svg')).not.toBeNull();
        expect(screen.getByTestId('benefit-pill').closest('a')).not.toBeNull();
        unmount();

        render(
            <AccountBar
                view={view}
                locale="es"
            />
        );
        await user.click(screen.getByRole('button', { name: /Mi cuenta/ }));
        await screen.findByRole('dialog');
        expect(screen.getByTestId('whats-new-pill').closest('a')).not.toBeNull();
    });

    it('reveals the AI-assistants entry in the drawer only when the user qualifies', async () => {
        const user = userEvent.setup();
        const open = async () => {
            await user.click(screen.getByRole('button', { name: /Mi cuenta/ }));
            const dialog = await screen.findByRole('dialog');
            return dialog.querySelector('[data-ai-assistants-entry]') as HTMLElement;
        };
        aiState.visible = false;
        const first = render(
            <AccountBar
                view={view}
                locale="es"
            />
        );
        expect(await open()).toHaveAttribute('hidden');
        first.unmount();
        aiState.visible = true;
        render(
            <AccountBar
                view={view}
                locale="es"
            />
        );
        expect(await open()).not.toHaveAttribute('hidden');
    });
});
