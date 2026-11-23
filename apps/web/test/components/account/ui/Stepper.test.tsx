/**
 * Tests for Stepper and stepStates (HOS-2501).
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stepper, stepStates } from '../../../../src/components/account/ui';

describe('stepStates', () => {
    it('marks the steps before the current one done and the rest upcoming', () => {
        // Arrange + Act
        const result = stepStates({ ids: ['a', 'b', 'c'], currentIndex: 1 });

        // Assert
        expect(result.map((step) => step.state)).toEqual(['done', 'current', 'upcoming']);
    });

    it('marks everything done when the index is past the last step', () => {
        const result = stepStates({ ids: ['a', 'b'], currentIndex: 2 });
        expect(result.every((step) => step.state === 'done')).toBe(true);
    });
});

describe('Stepper', () => {
    const steps = [
        { id: 'a', label: 'Tus datos', state: 'done' },
        { id: 'b', label: 'Preferencias', state: 'current' },
        { id: 'c', label: 'Confirmar', state: 'upcoming' }
    ] as const;

    it('renders a named ordered list with one item per step', () => {
        render(
            <Stepper
                steps={steps}
                locale="es"
                label="Progreso"
            />
        );

        const list = screen.getByRole('list', { name: 'Progreso' });
        expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    });

    it('flags only the current step with aria-current and spells every state out', () => {
        render(
            <Stepper
                steps={steps}
                locale="es"
                label="Progreso"
            />
        );

        const items = screen.getAllByRole('listitem');
        expect(items[0]).not.toHaveAttribute('aria-current');
        expect(items[1]).toHaveAttribute('aria-current', 'step');
        expect(items[0]).toHaveTextContent('completado');
        expect(items[1]).toHaveTextContent('paso actual');
        expect(items[2]).toHaveTextContent('pendiente');
    });

    it('shows a number for open steps and an icon, not a number, for a done one', () => {
        render(
            <Stepper
                steps={steps}
                locale="es"
                label="Progreso"
            />
        );

        const items = screen.getAllByRole('listitem');
        expect(items[0]?.querySelector('svg')).not.toBeNull();
        expect(items[1]).toHaveTextContent('2');
        expect(items[2]).toHaveTextContent('3');
    });
});
