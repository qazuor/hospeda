/**
 * Tests for the kit Stepper beyond the add-on purchase case covered in
 * `billing-pieces.test.tsx`: the «every step done» state the profile
 * completion needs (HOS-2501) and the marker content.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stepper } from '../../../../src/components/account/ui';

const STEPS = [
    { id: 'a', label: 'Tus datos' },
    { id: 'b', label: 'Preferencias' },
    { id: 'c', label: 'Confirmar' }
] as const;

describe('Stepper', () => {
    it('derives done / current / upcoming from the current index', () => {
        // Arrange & Act
        render(
            <Stepper
                steps={STEPS}
                current={1}
                label="Progreso"
                locale="es"
            />
        );

        // Assert
        const items = within(screen.getByRole('navigation', { name: 'Progreso' })).getAllByRole(
            'listitem'
        );
        expect(items.map((item) => item.getAttribute('data-state'))).toEqual([
            'done',
            'current',
            'upcoming'
        ]);
    });

    it('marks every step done, none current, when current equals the step count', () => {
        // Arrange & Act
        render(
            <Stepper
                steps={STEPS}
                current={STEPS.length}
                label="Progreso"
                locale="es"
            />
        );

        // Assert
        const items = screen.getAllByRole('listitem');
        expect(items.map((item) => item.getAttribute('data-state'))).toEqual([
            'done',
            'done',
            'done'
        ]);
        for (const item of items) {
            expect(item).not.toHaveAttribute('aria-current');
            expect(item).toHaveTextContent('completado');
        }
        expect(screen.getByText('Paso 3 de 3')).toBeInTheDocument();
    });

    it('shows a number for open steps and an icon, not a number, for a done one', () => {
        // Arrange & Act
        render(
            <Stepper
                steps={STEPS}
                current={1}
                label="Progreso"
                locale="es"
            />
        );

        // Assert
        const items = screen.getAllByRole('listitem');
        expect(items[0]?.querySelector('svg')).not.toBeNull();
        expect(items[0]).not.toHaveTextContent('1');
        expect(items[1]).toHaveTextContent('2');
        expect(items[2]).toHaveTextContent('3');
    });
});
