/**
 * @file DualRangeFilter.test.tsx
 * @description Unit tests for the DualRangeFilter component.
 * Tests dual slider rendering, min/max clamping, currency and number
 * label formatting, and onMinChange/onMaxChange callbacks.
 */

import { DualRangeFilter } from '@/components/shared/filter-types/DualRangeFilter';
import type { DualRangeFilterConfig } from '@/components/shared/filter-types/DualRangeFilter';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/components/shared/FilterSidebar.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

const baseConfig: DualRangeFilterConfig = {
    id: 'price',
    label: 'Precio',
    type: 'dual-range',
    min: 0,
    max: 1000,
    step: 50
};

/** Returns both range inputs: [minInput, maxInput]. */
function getRangeInputs(): [HTMLInputElement, HTMLInputElement] {
    const inputs = screen.getAllByRole('slider') as HTMLInputElement[];
    if (inputs.length !== 2) throw new Error(`Expected 2 range sliders, found ${inputs.length}`);
    return [inputs[0], inputs[1]];
}

describe('DualRangeFilter', () => {
    describe('rendering', () => {
        it('renders two range inputs', () => {
            // Arrange / Act
            render(
                <DualRangeFilter
                    config={baseConfig}
                    value={{ min: '100', max: '900' }}
                    onMinChange={vi.fn()}
                    onMaxChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(getRangeInputs()).toHaveLength(2);
        });

        it('sets the min slider value to the current min', () => {
            // Arrange / Act
            render(
                <DualRangeFilter
                    config={baseConfig}
                    value={{ min: '200', max: '800' }}
                    onMinChange={vi.fn()}
                    onMaxChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            const [minInput] = getRangeInputs();
            expect(minInput.value).toBe('200');
        });

        it('sets the max slider value to the current max', () => {
            // Arrange / Act
            render(
                <DualRangeFilter
                    config={baseConfig}
                    value={{ min: '200', max: '800' }}
                    onMinChange={vi.fn()}
                    onMaxChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            const [, maxInput] = getRangeInputs();
            expect(maxInput.value).toBe('800');
        });

        it('falls back to config.min when value.min is empty string', () => {
            // Arrange / Act
            render(
                <DualRangeFilter
                    config={baseConfig}
                    value={{ min: '', max: '500' }}
                    onMinChange={vi.fn()}
                    onMaxChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            const [minInput] = getRangeInputs();
            expect(Number(minInput.value)).toBe(baseConfig.min);
        });

        it('falls back to config.max when value.max is empty string', () => {
            // Arrange / Act
            render(
                <DualRangeFilter
                    config={baseConfig}
                    value={{ min: '0', max: '' }}
                    onMinChange={vi.fn()}
                    onMaxChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            const [, maxInput] = getRangeInputs();
            expect(Number(maxInput.value)).toBe(baseConfig.max);
        });

        it('sets correct aria-label on min slider using translated "mínimo"', () => {
            // Arrange / Act
            render(
                <DualRangeFilter
                    config={baseConfig}
                    value={{ min: '0', max: '1000' }}
                    onMinChange={vi.fn()}
                    onMaxChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert — t() returns fallback "mínimo"
            expect(screen.getByLabelText('Precio mínimo')).toBeInTheDocument();
        });

        it('sets correct aria-label on max slider using translated "máximo"', () => {
            // Arrange / Act
            render(
                <DualRangeFilter
                    config={baseConfig}
                    value={{ min: '0', max: '1000' }}
                    onMinChange={vi.fn()}
                    onMaxChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(screen.getByLabelText('Precio máximo')).toBeInTheDocument();
        });
    });

    describe('label formatting', () => {
        it('shows plain number labels when format is "number"', () => {
            // Arrange
            const config: DualRangeFilterConfig = { ...baseConfig, format: 'number' };

            // Act
            const { container } = render(
                <DualRangeFilter
                    config={config}
                    value={{ min: '100', max: '900' }}
                    onMinChange={vi.fn()}
                    onMaxChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert — labels visible as text (aria-hidden div)
            const labelDiv = container.querySelector('[aria-hidden="true"]');
            expect(labelDiv?.textContent).toContain('100');
            expect(labelDiv?.textContent).toContain('900');
            expect(labelDiv?.textContent).not.toContain('$');
        });

        it('shows currency-formatted labels when format is "currency"', () => {
            // Arrange
            const config: DualRangeFilterConfig = { ...baseConfig, format: 'currency' };

            // Act
            const { container } = render(
                <DualRangeFilter
                    config={config}
                    value={{ min: '1000', max: '5000' }}
                    onMinChange={vi.fn()}
                    onMaxChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert — currency format prefixes $
            const labelDiv = container.querySelector('[aria-hidden="true"]');
            expect(labelDiv?.textContent).toContain('$');
        });

        it('uses plain number format by default (no format specified)', () => {
            // Arrange — config without format field
            const config: DualRangeFilterConfig = {
                id: 'rooms',
                label: 'Habitaciones',
                type: 'dual-range',
                min: 1,
                max: 10
            };

            // Act
            const { container } = render(
                <DualRangeFilter
                    config={config}
                    value={{ min: '2', max: '8' }}
                    onMinChange={vi.fn()}
                    onMaxChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            const labelDiv = container.querySelector('[aria-hidden="true"]');
            expect(labelDiv?.textContent).not.toContain('$');
            expect(labelDiv?.textContent).toContain('2');
            expect(labelDiv?.textContent).toContain('8');
        });
    });

    describe('min/max clamping', () => {
        it('clamps min to currentMax - step when min slider exceeds max', () => {
            // Arrange
            const onMinChange = vi.fn();
            render(
                <DualRangeFilter
                    config={baseConfig}
                    value={{ min: '400', max: '500' }}
                    onMinChange={onMinChange}
                    onMaxChange={vi.fn()}
                    locale="es"
                />
            );

            // Act — attempt to move min to 500 (equal to max)
            const [minInput] = getRangeInputs();
            fireEvent.change(minInput, { target: { value: '500' } });

            // Assert — clamped to max - step = 500 - 50 = 450
            expect(onMinChange).toHaveBeenCalledWith('450');
        });

        it('clamps max to currentMin + step when max slider goes below min', () => {
            // Arrange
            const onMaxChange = vi.fn();
            render(
                <DualRangeFilter
                    config={baseConfig}
                    value={{ min: '400', max: '500' }}
                    onMinChange={vi.fn()}
                    onMaxChange={onMaxChange}
                    locale="es"
                />
            );

            // Act — attempt to move max to 400 (equal to min)
            const [, maxInput] = getRangeInputs();
            fireEvent.change(maxInput, { target: { value: '400' } });

            // Assert — clamped to min + step = 400 + 50 = 450
            expect(onMaxChange).toHaveBeenCalledWith('450');
        });

        it('calls onMinChange with a string value', () => {
            // Arrange
            const onMinChange = vi.fn();
            render(
                <DualRangeFilter
                    config={baseConfig}
                    value={{ min: '100', max: '800' }}
                    onMinChange={onMinChange}
                    onMaxChange={vi.fn()}
                    locale="es"
                />
            );

            // Act
            const [minInput] = getRangeInputs();
            fireEvent.change(minInput, { target: { value: '200' } });

            // Assert — always a string
            expect(typeof onMinChange.mock.calls[0][0]).toBe('string');
        });

        it('calls onMaxChange with a string value', () => {
            // Arrange
            const onMaxChange = vi.fn();
            render(
                <DualRangeFilter
                    config={baseConfig}
                    value={{ min: '100', max: '800' }}
                    onMinChange={vi.fn()}
                    onMaxChange={onMaxChange}
                    locale="es"
                />
            );

            // Act
            const [, maxInput] = getRangeInputs();
            fireEvent.change(maxInput, { target: { value: '700' } });

            // Assert
            expect(typeof onMaxChange.mock.calls[0][0]).toBe('string');
        });
    });
});
