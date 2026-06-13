/**
 * @file ViewsWidget.test.tsx
 * @description Tests for ViewsWidget — per-property ranked list of accommodation
 * views with 7d/30d toggle, loading skeleton, error, and empty states.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ViewsWidget } from '../../../src/components/host/ViewsWidget.client';

const mockData = {
    window: '7d' as const,
    items: [
        { accommodationId: 'a1', name: 'Casa del Sol', total: 42, unique: 30 },
        { accommodationId: 'a2', name: 'Cabaña del Río', total: 28, unique: 20 },
        { accommodationId: 'a3', name: 'Apartamento Centro', total: 15, unique: 12 }
    ]
};

describe('ViewsWidget', () => {
    it('renders loading skeleton when loading', () => {
        render(
            <ViewsWidget
                locale="es"
                data={undefined}
                isLoading={true}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.getByTestId('views-skeleton')).toBeInTheDocument();
    });

    it('renders error state with role alert and message', () => {
        render(
            <ViewsWidget
                locale="es"
                data={undefined}
                isLoading={false}
                error="Error al cargar vistas"
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Error al cargar vistas')).toBeInTheDocument();
    });

    it('renders empty state when data has no items', () => {
        render(
            <ViewsWidget
                locale="es"
                data={{ window: '7d', items: [] }}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.getByText(/Sin datos/i)).toBeInTheDocument();
    });

    it('renders empty state when all items have total === 0', () => {
        render(
            <ViewsWidget
                locale="es"
                data={{
                    window: '30d',
                    items: [{ accommodationId: 'a1', name: 'Casa', total: 0, unique: 0 }]
                }}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.getByText(/Sin datos/i)).toBeInTheDocument();
    });

    it('renders accommodation names and totals sorted by total desc', () => {
        render(
            <ViewsWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.getByText('Casa del Sol')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText('Cabaña del Río')).toBeInTheDocument();
        expect(screen.getByText('28')).toBeInTheDocument();
        expect(screen.getByText('Apartamento Centro')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('shows the total badge with sum of all items totals', () => {
        render(
            <ViewsWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        // 42 + 28 + 15 = 85
        expect(screen.getByText('85')).toBeInTheDocument();
    });

    it('shows 7d toggle as active when data.window is 7d', () => {
        render(
            <ViewsWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        const btn7d = screen.getByRole('button', { name: /7d/i });
        expect(btn7d).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onWindowChange with 30d when toggle is clicked', async () => {
        const user = userEvent.setup();
        const onWindowChange = vi.fn();
        render(
            <ViewsWidget
                locale="es"
                data={mockData}
                isLoading={false}
                error={null}
                onWindowChange={onWindowChange}
            />
        );
        const btn30d = screen.getByRole('button', { name: /30d/i });
        await user.click(btn30d);
        expect(onWindowChange).toHaveBeenCalledWith('30d');
    });

    it('falls back to unnamed translation when accommodation name is empty', () => {
        render(
            <ViewsWidget
                locale="es"
                data={{
                    window: '7d',
                    items: [{ accommodationId: 'x1', name: '', total: 10, unique: 8 }]
                }}
                isLoading={false}
                error={null}
                onWindowChange={vi.fn()}
            />
        );
        expect(screen.getByText(/Sin nombre/i)).toBeInTheDocument();
    });
});
