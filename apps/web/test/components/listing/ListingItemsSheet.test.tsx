/**
 * @file ListingItemsSheet.test.tsx
 * @description HOS-2528 / AC-2.3: the «Ver las N» button opens a `sheet` dialog that lists
 * every item, and closing it returns focus to the button.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ListingItemsSheet } from '@/components/listing/ListingItemsSheet.client';

const items = Array.from({ length: 12 }, (_, index) => `Comodidad ${index + 1}`);

function renderSheet() {
    return render(
        <ListingItemsSheet
            sheetId="amenities-sheet"
            triggerLabel="Ver las 12 comodidades"
            title="Comodidades"
            closeLabel="Cerrar"
        >
            <ul>
                {items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        </ListingItemsSheet>
    );
}

describe('ListingItemsSheet', () => {
    it('renders only the trigger while closed', () => {
        renderSheet();

        expect(screen.getByRole('button', { name: 'Ver las 12 comodidades' })).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByText('Comodidad 12')).not.toBeInTheDocument();
    });

    it('opens a sheet dialog listing all 12 items', () => {
        renderSheet();
        fireEvent.click(screen.getByRole('button', { name: 'Ver las 12 comodidades' }));

        const dialog = screen.getByRole('dialog', { name: 'Comodidades' });
        expect(dialog).toHaveAttribute('data-variant', 'sheet');
        expect(dialog.querySelectorAll('li')).toHaveLength(12);
    });

    it('closes from the close button and restores focus to the trigger', async () => {
        renderSheet();
        const trigger = screen.getByRole('button', { name: 'Ver las 12 comodidades' });
        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it('renders the trigger as the shared outline GradientButton (HOS-2533)', () => {
        renderSheet();
        const trigger = screen.getByRole('button', { name: 'Ver las 12 comodidades' });

        expect(trigger).toHaveClass(
            'btn-gradient',
            'btn-gradient--outline-primary',
            'btn-gradient--sm'
        );
        expect(trigger).toHaveAttribute('type', 'button');
        expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
});
