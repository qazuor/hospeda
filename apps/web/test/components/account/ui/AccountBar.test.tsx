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
        render(
            <AccountBar
                view={view}
                locale="es"
            />
        );
        await user.click(screen.getByRole('button', { name: /Mi cuenta/ }));
        const dialog = await screen.findByRole('dialog');
        const firstLink = dialog.querySelector('a') as HTMLElement;
        expect(firstLink.querySelector('svg')).not.toBeNull();
        expect(screen.getByTestId('whats-new-pill').closest('a')).not.toBeNull();
        expect(screen.getByTestId('benefit-pill').closest('a')).not.toBeNull();
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
