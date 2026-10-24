import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapCardsSheetTrigger } from '@/components/maps/MapCardsSheetTrigger';

describe('MapCardsSheetTrigger', () => {
    it('portals a dock item with the original sheet state and control relationship', () => {
        const slot = document.createElement('div');
        slot.dataset.mobileDockSlot = 'map-cards';
        document.body.append(slot);
        const onOpen = vi.fn();
        render(
            <MapCardsSheetTrigger
                label="Ver 3 resultados"
                isSheetOpen={false}
                onOpen={onOpen}
            />
        );
        const trigger = screen.getByRole('button', { name: 'Ver 3 resultados' });
        expect(slot).toContainElement(trigger);
        expect(trigger).toHaveAttribute('data-dock-item');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).toHaveAttribute('aria-controls', 'map-cards-sheet');
        fireEvent.click(trigger);
        expect(onOpen).toHaveBeenCalledOnce();
        slot.remove();
    });
});
