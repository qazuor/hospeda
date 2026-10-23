import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterDockTrigger } from '@/components/shared/filters/components/FilterDockTrigger';

describe('FilterDockTrigger', () => {
    it('renders the labelled trigger, badge only for active filters, state and dock marker', () => {
        const onOpen = vi.fn();
        const { rerender } = render(
            <FilterDockTrigger
                label="Filtros"
                activeCount={0}
                isOpen={false}
                onOpen={onOpen}
            />
        );
        const trigger = screen.getByRole('button', { name: 'Filtros' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
        expect(trigger).toHaveAttribute('data-dock-item');
        expect(trigger).not.toHaveTextContent('0');

        rerender(
            <FilterDockTrigger
                label="Filtros"
                activeCount={2}
                isOpen
                onOpen={onOpen}
            />
        );
        expect(screen.getByRole('button', { name: 'Filtros' })).toHaveAttribute(
            'aria-expanded',
            'true'
        );
        expect(screen.getByText('2')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
        expect(onOpen).toHaveBeenCalledOnce();
    });

    it('portals the trigger into the filters slot and falls back in place without a slot', () => {
        const slot = document.createElement('div');
        slot.dataset.mobileDockSlot = 'filters';
        document.body.append(slot);
        const { unmount } = render(
            <FilterDockTrigger
                label="Filtros"
                activeCount={0}
                isOpen={false}
                onOpen={vi.fn()}
            />
        );
        expect(slot.querySelector('[data-dock-item]')).toBeInTheDocument();
        unmount();
        slot.remove();

        const { container } = render(
            <FilterDockTrigger
                label="Filtros"
                activeCount={0}
                isOpen={false}
                onOpen={vi.fn()}
            />
        );
        expect(container.querySelector('[data-dock-item]')).toBeInTheDocument();
    });
});
