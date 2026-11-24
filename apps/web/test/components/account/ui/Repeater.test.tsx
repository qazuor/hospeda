/**
 * Tests for the kit Repeater (HOS-2490, spec HOS-2415 §6.5).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Repeater } from '../../../../src/components/account/ui';

const uiDir = resolve(__dirname, '../../../../src/components/account/ui');

interface Row {
    readonly name: string;
}

function renderRepeater(overrides: Partial<React.ComponentProps<typeof Repeater<Row>>> = {}) {
    const onMove = vi.fn();
    const onRemove = vi.fn();
    const onAdd = vi.fn();
    const utils = render(
        <Repeater<Row>
            locale="es"
            label="Platos"
            items={[{ name: 'Empanadas' }, { name: 'Locro' }]}
            getKey={(row) => row.name}
            getItemLabel={(row) => row.name}
            renderItem={(row) => <span>campos de {row.name}</span>}
            onMove={onMove}
            onRemove={onRemove}
            onAdd={onAdd}
            addLabel="Agregar plato"
            {...overrides}
        />
    );
    return { ...utils, onMove, onRemove, onAdd };
}

describe('Repeater', () => {
    it('renders a labelled ordered list with one row per item and its visible label', () => {
        // Arrange / Act
        renderRepeater();

        // Assert
        const list = screen.getByRole('list', { name: 'Platos' });
        const rows = within(list).getAllByRole('listitem');
        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveAccessibleName('Empanadas');
        expect(within(rows[0] as HTMLElement).getByText('campos de Empanadas')).toBeInTheDocument();
    });

    it('moves a row with labelled buttons and never past either end', async () => {
        // Arrange
        const user = userEvent.setup();
        const { onMove } = renderRepeater();

        // Assert the ends
        expect(screen.getByRole('button', { name: 'Subir Empanadas' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Bajar Locro' })).toBeDisabled();

        // Act
        await user.click(screen.getByRole('button', { name: 'Bajar Empanadas' }));

        // Assert
        expect(onMove).toHaveBeenCalledWith(0, 1);
    });

    it('asks before removing and removes only on confirm (HOS-2429)', async () => {
        // Arrange
        const user = userEvent.setup();
        const { onRemove } = renderRepeater();

        // Act: cancel first
        await user.click(screen.getByRole('button', { name: 'Quitar Locro' }));
        const dialog = await screen.findByRole('alertdialog', { name: '¿Quitar «Locro»?' });
        await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

        // Assert
        expect(onRemove).not.toHaveBeenCalled();

        // Act: confirm
        await user.click(screen.getByRole('button', { name: 'Quitar Locro' }));
        const again = await screen.findByRole('alertdialog');
        await user.click(within(again).getByRole('button', { name: 'Quitar' }));

        // Assert
        expect(onRemove).toHaveBeenCalledWith(1);
    });

    it('uses the caller confirmation copy when given', async () => {
        // Arrange
        const user = userEvent.setup();
        renderRepeater({
            getRemoveConfirm: () => ({
                title: 'Quitar plato',
                description: '¿Quitar este plato de la carta?',
                confirmLabel: 'Quitar plato'
            })
        });

        // Act
        await user.click(screen.getByRole('button', { name: 'Quitar Empanadas' }));

        // Assert
        expect(await screen.findByRole('alertdialog', { name: 'Quitar plato' })).toHaveTextContent(
            '¿Quitar este plato de la carta?'
        );
    });

    it('adds through its button and honours canAdd', async () => {
        // Arrange
        const user = userEvent.setup();
        const { onAdd, rerender } = renderRepeater();

        // Act
        await user.click(screen.getByRole('button', { name: 'Agregar plato' }));

        // Assert
        expect(onAdd).toHaveBeenCalledTimes(1);

        rerender(
            <Repeater<Row>
                locale="es"
                label="Platos"
                items={[]}
                getKey={(row) => row.name}
                getItemLabel={(row) => row.name}
                renderItem={() => null}
                onAdd={onAdd}
                addLabel="Agregar plato"
                canAdd={false}
                empty={{ title: 'Todavía no hay platos' }}
            />
        );
        expect(screen.getByRole('button', { name: 'Agregar plato' })).toBeDisabled();
        expect(screen.getByText('Todavía no hay platos')).toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('hides the move and remove buttons when their handlers are absent', () => {
        renderRepeater({ onMove: undefined, onRemove: undefined });
        expect(
            screen.queryByRole('button', { name: /Subir|Bajar|Quitar/ })
        ).not.toBeInTheDocument();
    });

    it('forwards the help anchor and adapts to its container, not the viewport', () => {
        const { container } = renderRepeater({ helpId: 'section:menu.dishes' });
        expect(container.firstElementChild).toHaveAttribute('data-help', 'section:menu.dishes');

        const css = readFileSync(resolve(uiDir, 'Repeater.module.css'), 'utf8');
        expect(css).toContain('container-type: inline-size');
        expect(css).toContain('@container (width >= 30rem)');
        expect(css).not.toContain('@media');
    });
});
