/**
 * Tests for the kit Menu (HOS-2483): the WAI-ARIA menu button pattern.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Menu, type MenuItem } from '../../../../src/components/account/ui';

function setup(items: readonly MenuItem[]) {
    const user = userEvent.setup();
    render(
        <div>
            <Menu
                label="Más acciones para Casa del Río"
                locale="es"
                items={items}
            />
            <button type="button">afuera</button>
        </div>
    );
    return {
        user,
        trigger: screen.getByRole('button', { name: 'Más acciones para Casa del Río' })
    };
}

const LINKS: readonly MenuItem[] = [
    { id: 'edit', label: 'Editar', href: '/es/editar/' },
    { id: 'view', label: 'Ver en el sitio', href: '/es/casa/', external: true },
    { id: 'off', label: 'Deshabilitado', href: '/es/x/', disabled: true }
];

describe('Menu (kit)', () => {
    it('renders a labelled, collapsed trigger that controls no menu while closed', () => {
        // Arrange & Act
        const { trigger } = setup(LINKS);

        // Assert
        expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('opens on click with the first item focused, and links the menu to its trigger', async () => {
        // Arrange
        const { user, trigger } = setup(LINKS);

        // Act
        await user.click(trigger);

        // Assert
        const menu = screen.getByRole('menu');
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(trigger).toHaveAttribute('aria-controls', menu.id);
        expect(menu).toHaveAttribute('aria-labelledby', trigger.id);
        expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveFocus();
    });

    it('moves with the arrow keys, wraps, skips disabled items and supports Home/End', async () => {
        // Arrange
        const { user, trigger } = setup(LINKS);
        trigger.focus();

        // Act + Assert
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveFocus();
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('menuitem', { name: /Ver en el sitio/ })).toHaveFocus();
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveFocus();
        await user.keyboard('{ArrowUp}');
        expect(screen.getByRole('menuitem', { name: /Ver en el sitio/ })).toHaveFocus();
        await user.keyboard('{Home}');
        expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveFocus();
        await user.keyboard('{End}');
        expect(screen.getByRole('menuitem', { name: /Ver en el sitio/ })).toHaveFocus();
    });

    it('opens on the last item with ArrowUp', async () => {
        const { user, trigger } = setup(LINKS);
        trigger.focus();
        await user.keyboard('{ArrowUp}');
        expect(screen.getByRole('menuitem', { name: /Ver en el sitio/ })).toHaveFocus();
    });

    it('closes on Escape and returns focus to the trigger', async () => {
        // Arrange
        const { user, trigger } = setup(LINKS);
        await user.click(trigger);

        // Act
        await user.keyboard('{Escape}');

        // Assert
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes on a click outside', async () => {
        const { user, trigger } = setup(LINKS);
        await user.click(trigger);
        await user.click(screen.getByRole('button', { name: 'afuera' }));
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('renders link items as real links, external ones in a new tab with hidden text', async () => {
        // Arrange
        const { user, trigger } = setup(LINKS);

        // Act
        await user.click(trigger);

        // Assert
        const menu = screen.getByRole('menu');
        expect(within(menu).getByRole('menuitem', { name: 'Editar' })).toHaveAttribute(
            'href',
            '/es/editar/'
        );
        const external = within(menu).getByRole('menuitem', { name: /Ver en el sitio/ });
        expect(external).toHaveAttribute('target', '_blank');
        expect(external).toHaveAttribute('rel', 'noopener noreferrer');
        expect(external).toHaveTextContent('se abre en otra pestaña');
    });

    it('runs onSelect after closing and returning focus to the trigger', async () => {
        // Arrange
        const order: string[] = [];
        const onSelect = vi.fn(() => {
            order.push(document.activeElement?.getAttribute('aria-label') ?? 'other');
        });
        const { user, trigger } = setup([
            { id: 'delete', label: 'Eliminar', onSelect, tone: 'danger' }
        ]);
        await user.click(trigger);

        // Act
        await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }));

        // Assert
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(order).toEqual(['Más acciones para Casa del Río']);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('never runs a disabled action', async () => {
        const onSelect = vi.fn();
        const { user, trigger } = setup([
            { id: 'a', label: 'Activa', onSelect: vi.fn() },
            { id: 'b', label: 'Bloqueada', onSelect, disabled: true }
        ]);
        await user.click(trigger);
        const blocked = screen.getByRole('menuitem', { name: 'Bloqueada' });
        expect(blocked).toHaveAttribute('aria-disabled', 'true');
        await user.click(blocked);
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('renders nothing without items', () => {
        const { container } = render(
            <Menu
                label="x"
                locale="es"
                items={[]}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });
});
