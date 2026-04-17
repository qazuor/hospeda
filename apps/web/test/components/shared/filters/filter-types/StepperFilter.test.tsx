/**
 * @file StepperFilter.test.tsx
 * @description Unit tests for the StepperFilter component.
 * Tests increment/decrement behavior, min/max bounds, suffix display,
 * and onChange callback invocation.
 */

import { StepperFilter } from '@/components/shared/filters/filter-types/StepperFilter';
import type { StepperFilterConfig } from '@/components/shared/filters/filter-types/StepperFilter';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/components/shared/filters/FilterSidebar.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ')
}));

const baseConfig: StepperFilterConfig = {
    id: 'guests',
    label: 'Huéspedes',
    type: 'stepper',
    min: 0,
    max: 10
};

describe('StepperFilter', () => {
    describe('rendering', () => {
        it('renders the current value', () => {
            // Arrange / Act
            render(
                <StepperFilter
                    config={baseConfig}
                    value={3}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(screen.getByText('3')).toBeInTheDocument();
        });

        it('renders the suffix when provided', () => {
            // Arrange
            const config: StepperFilterConfig = { ...baseConfig, suffix: 'noches' };

            // Act
            render(
                <StepperFilter
                    config={config}
                    value={2}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(screen.getByText('noches')).toBeInTheDocument();
        });

        it('does not render a suffix when not provided', () => {
            // Arrange / Act
            const { container } = render(
                <StepperFilter
                    config={baseConfig}
                    value={1}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert — the aria-live span should contain only the number text, no suffix child
            const liveRegion = container.querySelector('[aria-live="polite"]');
            expect(liveRegion).toBeInTheDocument();
            // No suffix span inside
            expect(liveRegion?.querySelector('span')).not.toBeInTheDocument();
            expect(liveRegion?.textContent).toBe('1');
        });

        it('renders decrement and increment buttons with aria-labels', () => {
            // Arrange / Act
            render(
                <StepperFilter
                    config={baseConfig}
                    value={3}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(
                screen.getByRole('button', { name: /disminuir huéspedes/i })
            ).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /aumentar huéspedes/i })).toBeInTheDocument();
        });
    });

    describe('increment', () => {
        it('calls onChange with value + 1 when increment is clicked', () => {
            // Arrange
            const onChange = vi.fn();
            render(
                <StepperFilter
                    config={baseConfig}
                    value={3}
                    onChange={onChange}
                    locale="es"
                />
            );

            // Act
            fireEvent.click(screen.getByRole('button', { name: /aumentar/i }));

            // Assert
            expect(onChange).toHaveBeenCalledOnce();
            expect(onChange).toHaveBeenCalledWith(4);
        });

        it('disables the increment button when value equals max', () => {
            // Arrange / Act
            render(
                <StepperFilter
                    config={baseConfig}
                    value={10}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(screen.getByRole('button', { name: /aumentar/i })).toBeDisabled();
        });

        it('does not call onChange when increment is clicked at max', () => {
            // Arrange
            const onChange = vi.fn();
            render(
                <StepperFilter
                    config={baseConfig}
                    value={10}
                    onChange={onChange}
                    locale="es"
                />
            );

            // Act
            fireEvent.click(screen.getByRole('button', { name: /aumentar/i }));

            // Assert
            expect(onChange).not.toHaveBeenCalled();
        });
    });

    describe('decrement', () => {
        it('calls onChange with value - 1 when decrement is clicked', () => {
            // Arrange
            const onChange = vi.fn();
            render(
                <StepperFilter
                    config={baseConfig}
                    value={5}
                    onChange={onChange}
                    locale="es"
                />
            );

            // Act
            fireEvent.click(screen.getByRole('button', { name: /disminuir/i }));

            // Assert
            expect(onChange).toHaveBeenCalledOnce();
            expect(onChange).toHaveBeenCalledWith(4);
        });

        it('disables the decrement button when value equals min', () => {
            // Arrange / Act
            render(
                <StepperFilter
                    config={baseConfig}
                    value={0}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(screen.getByRole('button', { name: /disminuir/i })).toBeDisabled();
        });

        it('does not call onChange when decrement is clicked at min', () => {
            // Arrange
            const onChange = vi.fn();
            render(
                <StepperFilter
                    config={baseConfig}
                    value={0}
                    onChange={onChange}
                    locale="es"
                />
            );

            // Act
            fireEvent.click(screen.getByRole('button', { name: /disminuir/i }));

            // Assert
            expect(onChange).not.toHaveBeenCalled();
        });
    });

    describe('default bounds', () => {
        it('uses 0 as default min when not specified', () => {
            // Arrange
            const config: StepperFilterConfig = { id: 'x', label: 'X', type: 'stepper' };

            // Act
            render(
                <StepperFilter
                    config={config}
                    value={0}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(screen.getByRole('button', { name: /disminuir/i })).toBeDisabled();
        });

        it('uses 99 as default max when not specified', () => {
            // Arrange
            const config: StepperFilterConfig = { id: 'x', label: 'X', type: 'stepper' };

            // Act
            render(
                <StepperFilter
                    config={config}
                    value={99}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(screen.getByRole('button', { name: /aumentar/i })).toBeDisabled();
        });
    });
});
