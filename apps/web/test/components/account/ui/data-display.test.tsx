/**
 * Tests for the phase-3 data display pieces of the kit (HOS-2414): StatCard /
 * StatGrid, ListRow and Avatar.
 *
 * The rule that matters most: a StatCard whose read failed shows «—» and a
 * retry, never `0` (HOS-2424), and a locked one shows the LockedState with no
 * number at all.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    Avatar,
    avatarInitials,
    avatarPalette,
    ListRow,
    StatCard,
    StatGrid
} from '../../../../src/components/account/ui';

const card = (container: HTMLElement) => container.querySelector('[data-widget]') as HTMLElement;

describe('StatCard', () => {
    it('prefers the next step and preserves the full clamped details in its title', () => {
        render(
            <StatCard
                id="plan"
                label="Plan"
                locale="en"
                state={{
                    status: 'ready',
                    data: {
                        value: 'Pro',
                        hint: 'Old hint',
                        nextStep: 'Update payment',
                        detail: 'Charge declined. Update your payment method.'
                    }
                }}
            />
        );
        expect(screen.getByText('Update payment')).toHaveAttribute(
            'title',
            'Charge declined. Update your payment method.'
        );
        expect(screen.queryByText('Old hint')).toBeNull();
    });

    it('provides context without a numeric value when the metric does not apply', () => {
        const { container } = render(
            <StatCard
                id="na"
                label="Views"
                locale="en"
                state={{ status: 'empty' }}
                context="No public page"
            />
        );
        expect(screen.getByText('No public page')).toHaveAttribute('title', 'No public page');
        expect(card(container).textContent).not.toMatch(/\d/);
    });
    it('renders the value, hint and link when ready', () => {
        // Arrange / Act
        const { container } = render(
            <StatCard
                id="props"
                label="Propiedades"
                locale="es"
                state={{ status: 'ready', data: { value: 7, hint: '3 publicadas' } }}
                link={{ href: '/es/x/', label: 'Gestionar' }}
            />
        );
        // Assert
        expect(card(container)).toHaveAttribute('data-widget', 'props');
        expect(card(container)).toHaveAttribute('data-state', 'ready');
        expect(screen.getByText('7')).toBeInTheDocument();
        expect(screen.getByText('3 publicadas')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Gestionar' })).toHaveAttribute('href', '/es/x/');
    });

    it('keeps a real zero as a value: «0» is only ever a ready number', () => {
        render(
            <StatCard
                id="z"
                label="Mensajes"
                locale="es"
                state={{ status: 'ready', data: { value: 0 } }}
            />
        );
        expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('shows a skeleton while loading', () => {
        const { container } = render(
            <StatCard
                id="l"
                label="Mensajes"
                locale="es"
                state={{ status: 'loading' }}
            />
        );
        expect(card(container)).toHaveAttribute('data-state', 'loading');
        expect(card(container).textContent).not.toMatch(/\d/);
    });

    it('a failed read shows «—», an announced alert and a working retry, never 0', async () => {
        // Arrange
        const retry = vi.fn();
        const user = userEvent.setup();
        const { container } = render(
            <StatCard
                id="e"
                label="Visitas"
                locale="es"
                state={{ status: 'error', retry }}
            />
        );
        // Act
        await user.click(screen.getByRole('button', { name: /reintentar/i }));
        // Assert
        expect(card(container)).toHaveAttribute('data-state', 'error');
        expect(card(container).textContent).toContain('—');
        expect(card(container).textContent).not.toMatch(/\b0\b/);
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(retry).toHaveBeenCalledOnce();
    });

    it('a locked card renders the LockedState with the plans and no number nor link', () => {
        const { container } = render(
            <StatCard
                id="k"
                label="Visitas"
                locale="es"
                link={{ href: '/es/x/', label: 'Gestionar' }}
                state={{
                    status: 'locked',
                    reason: {
                        kind: 'plan',
                        feature: 'Estadísticas',
                        description: 'Vienen con estos planes.',
                        plans: [{ name: 'Plan Fixture' }],
                        plansHref: '/es/planes/'
                    }
                }}
            />
        );
        const root = card(container);
        expect(within(root).getByText('Plan Fixture')).toBeInTheDocument();
        expect(within(root).queryByRole('link', { name: 'Gestionar' })).toBeNull();
        expect(root.textContent).not.toMatch(/\b\d+\b/);
    });
});

describe('StatGrid', () => {
    it('wraps its cards and carries the help anchor', () => {
        const { container } = render(
            <StatGrid helpId="section:host.dashboard">
                <StatCard
                    id="a"
                    label="A"
                    locale="es"
                    state={{ status: 'empty' }}
                />
            </StatGrid>
        );
        expect(container.firstElementChild).toHaveAttribute('data-help', 'section:host.dashboard');
        expect(container.querySelectorAll('[data-widget]')).toHaveLength(1);
    });
});

describe('ListRow', () => {
    it('renders the title as the row link, with description and data-row', () => {
        render(
            <ul>
                <ListRow
                    title="Editar perfil"
                    description="Tus datos"
                    href="/es/mi-cuenta/editar/"
                    rowId="edit"
                />
            </ul>
        );
        const link = screen.getByRole('link', { name: 'Editar perfil' });
        expect(link).toHaveAttribute('href', '/es/mi-cuenta/editar/');
        expect(link.closest('li')).toHaveAttribute('data-row', 'edit');
        expect(screen.getByText('Tus datos')).toBeInTheDocument();
    });

    it('renders meta and at most two actions', () => {
        render(
            <ul>
                <ListRow
                    title="Casa"
                    meta="hace 2 días"
                    actions={[
                        <button
                            key="a"
                            type="button"
                        >
                            Editar
                        </button>,
                        <button
                            key="b"
                            type="button"
                        >
                            Borrar
                        </button>
                    ]}
                />
            </ul>
        );
        expect(screen.getByText('hace 2 días')).toBeInTheDocument();
        expect(screen.getAllByRole('button')).toHaveLength(2);
        expect(screen.queryByRole('link')).toBeNull();
    });
});

describe('Avatar', () => {
    it('agrees with the shared helper for business display names', () => {
        render(<Avatar name="Host y Comercio" />);
        expect(screen.getByText('HC')).toBeInTheDocument();
        expect(avatarInitials({ name: 'Host y Comercio' })).toBe('HC');
    });
    it('derives up to two initials and a stable palette', () => {
        expect(avatarInitials({ name: '  ana   maría pérez ' })).toBe('AM');
        expect(avatarInitials({ name: '' })).toBe('');
        expect(avatarPalette({ name: 'Ana' })).toBe(avatarPalette({ name: 'Ana' }));
        expect([1, 2, 3, 4]).toContain(avatarPalette({ name: 'Bruno' }));
    });

    it('names the person for assistive tech unless decorative', () => {
        const { rerender, container } = render(<Avatar name="Ana Pérez" />);
        expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
        rerender(
            <Avatar
                name="Ana Pérez"
                decorative
            />
        );
        expect(screen.queryByText('Ana Pérez')).toBeNull();
        expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    });

    it('uses the picture with the name as alt when given', () => {
        render(
            <Avatar
                name="Ana Pérez"
                src="/a.png"
            />
        );
        expect(screen.getByRole('img', { name: 'Ana Pérez' })).toHaveAttribute('src', '/a.png');
    });
});
