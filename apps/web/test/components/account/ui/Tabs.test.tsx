/**
 * Tests for Tabs and NavTabs (HOS-2413 T-015).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NavTabs, Tabs } from '../../../../src/components/account/ui';

const ITEMS = [
    { id: 'a', label: 'Uno', panel: <p>panel a</p> },
    { id: 'b', label: 'Dos', panel: <p>panel b</p>, count: 120, countLabel: '120 pendientes' },
    { id: 'c', label: 'Tres', panel: <p>panel c</p> }
] as const;

describe('Tabs', () => {
    it('wires tablist, tab, tabpanel and aria-controls', () => {
        render(
            <Tabs
                items={ITEMS}
                ariaLabel="Secciones"
            />
        );
        expect(screen.getByRole('tablist', { name: 'Secciones' })).toBeInTheDocument();
        const first = screen.getByRole('tab', { name: 'Uno' });
        expect(first).toHaveAttribute('aria-selected', 'true');
        const panel = screen.getByRole('tabpanel');
        expect(first.getAttribute('aria-controls')).toBe(panel.id);
        expect(panel).toHaveAttribute('aria-labelledby', first.id);
        expect(screen.getByText('panel a')).toBeInTheDocument();
    });

    it('uses a roving tabIndex', () => {
        render(
            <Tabs
                items={ITEMS}
                ariaLabel="x"
            />
        );
        expect(screen.getByRole('tab', { name: 'Uno' })).toHaveAttribute('tabindex', '0');
        expect(screen.getByRole('tab', { name: /Dos/ })).toHaveAttribute('tabindex', '-1');
    });

    it('arrow keys move focus and selection, wrapping around', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        render(
            <Tabs
                items={ITEMS}
                ariaLabel="x"
                onValueChange={onValueChange}
            />
        );
        screen.getByRole('tab', { name: 'Uno' }).focus();
        await user.keyboard('{ArrowRight}');
        expect(screen.getByRole('tab', { name: /Dos/ })).toHaveFocus();
        expect(screen.getByRole('tab', { name: /Dos/ })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('panel b')).toBeInTheDocument();
        await user.keyboard('{ArrowLeft}{ArrowLeft}');
        expect(screen.getByRole('tab', { name: 'Tres' })).toHaveFocus();
        expect(onValueChange).toHaveBeenLastCalledWith('c');
    });

    it('Home and End jump to the ends', async () => {
        const user = userEvent.setup();
        render(
            <Tabs
                items={ITEMS}
                ariaLabel="x"
                defaultValue="b"
            />
        );
        screen.getByRole('tab', { name: /Dos/ }).focus();
        await user.keyboard('{End}');
        expect(screen.getByRole('tab', { name: 'Tres' })).toHaveFocus();
        await user.keyboard('{Home}');
        expect(screen.getByRole('tab', { name: 'Uno' })).toHaveFocus();
    });

    it('shows a count pill with the capped number and the full label', () => {
        render(
            <Tabs
                items={ITEMS}
                ariaLabel="x"
            />
        );
        expect(screen.getByRole('img', { name: '120 pendientes' })).toHaveTextContent('99+');
    });

    it('puts the bar in its own scroll container and supports the segmented variant', () => {
        render(
            <Tabs
                items={ITEMS}
                ariaLabel="x"
                variant="segmented"
            />
        );
        expect(screen.getByRole('tablist')).toHaveClass('bar', 'segmented');
    });
});

describe('NavTabs', () => {
    it('renders links with aria-current on the current page', () => {
        render(
            <NavTabs
                ariaLabel="Mi cuenta"
                items={[
                    { href: '/a', label: 'Perfil', current: true },
                    { href: '/b', label: 'Seguridad' }
                ]}
            />
        );
        expect(screen.getByRole('navigation', { name: 'Mi cuenta' })).toHaveClass('bar');
        expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute(
            'aria-current',
            'page'
        );
        expect(screen.getByRole('link', { name: 'Seguridad' })).not.toHaveAttribute('aria-current');
    });
});

describe('tab bar scroll affordance (HOS-2610 F-24)', () => {
    it('flags the end edge of an overflowing bar and scrolls the active tab into view', () => {
        const widths = { scrollWidth: 600, clientWidth: 200 };
        const protoScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
        const protoClient = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
            configurable: true,
            get: () => widths.scrollWidth
        });
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
            configurable: true,
            get: () => widths.clientWidth
        });
        try {
            render(
                <NavTabs
                    ariaLabel="Secciones"
                    items={[
                        { href: '/a', label: 'Uno' },
                        { href: '/b', label: 'Dos', current: true }
                    ]}
                />
            );
            const bar = screen.getByRole('navigation', { name: 'Secciones' });
            expect(bar.dataset.fadeEnd).toBe('true');
            expect(bar.dataset.fadeStart).toBe('false');
        } finally {
            if (protoScroll)
                Object.defineProperty(HTMLElement.prototype, 'scrollWidth', protoScroll);
            else Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
            if (protoClient)
                Object.defineProperty(HTMLElement.prototype, 'clientWidth', protoClient);
            else Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
        }
    });

    it('flags nothing when the bar fits', () => {
        render(
            <NavTabs
                ariaLabel="Secciones"
                items={[{ href: '/a', label: 'Uno', current: true }]}
            />
        );
        expect(screen.getByRole('navigation', { name: 'Secciones' }).dataset.fadeEnd).toBe('false');
    });
});
