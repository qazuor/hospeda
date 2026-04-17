/**
 * @file ToggleFilter.test.tsx
 * @description Unit tests for the ToggleFilter component.
 * Tests initial off state, toggle behavior, onChange invocation,
 * role="switch" semantics, and label rendering.
 */

import { ToggleFilter } from '@/components/shared/filters/filter-types/ToggleFilter';
import type { ToggleFilterConfig } from '@/components/shared/filters/filter-types/ToggleFilter';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/shared/filters/FilterSidebar.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

const baseConfig: ToggleFilterConfig = {
    id: 'featured',
    label: 'Solo destacados',
    type: 'toggle'
};

/** Returns the switch input element. */
function getSwitch(): HTMLInputElement {
    return screen.getByRole('switch') as HTMLInputElement;
}

describe('ToggleFilter', () => {
    describe('rendering', () => {
        it('renders with the provided label text', () => {
            // Arrange / Act
            render(
                <ToggleFilter
                    config={baseConfig}
                    value={false}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(screen.getByText('Solo destacados')).toBeInTheDocument();
        });

        it('renders an input with role="switch"', () => {
            // Arrange / Act
            render(
                <ToggleFilter
                    config={baseConfig}
                    value={false}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(getSwitch()).toBeInTheDocument();
        });

        it('renders as unchecked when value is false', () => {
            // Arrange / Act
            render(
                <ToggleFilter
                    config={baseConfig}
                    value={false}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(getSwitch()).not.toBeChecked();
        });

        it('renders as checked when value is true', () => {
            // Arrange / Act
            render(
                <ToggleFilter
                    config={baseConfig}
                    value={true}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(getSwitch()).toBeChecked();
        });

        it('sets aria-checked to false when value is false', () => {
            // Arrange / Act
            render(
                <ToggleFilter
                    config={baseConfig}
                    value={false}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(getSwitch()).toHaveAttribute('aria-checked', 'false');
        });

        it('sets aria-checked to true when value is true', () => {
            // Arrange / Act
            render(
                <ToggleFilter
                    config={baseConfig}
                    value={true}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(getSwitch()).toHaveAttribute('aria-checked', 'true');
        });

        it('associates the input with its label via htmlFor/id', () => {
            // Arrange / Act
            const { container } = render(
                <ToggleFilter
                    config={baseConfig}
                    value={false}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            const label = container.querySelector('label');
            const input = container.querySelector('input');
            expect(label?.htmlFor).toBe(input?.id);
            expect(input?.id).toBe('toggle-filter-featured');
        });
    });

    describe('interaction', () => {
        it('calls onChange with true when toggled from false', () => {
            // Arrange
            const onChange = vi.fn();
            render(
                <ToggleFilter
                    config={baseConfig}
                    value={false}
                    onChange={onChange}
                    locale="es"
                />
            );

            // Act
            fireEvent.click(getSwitch());

            // Assert
            expect(onChange).toHaveBeenCalledOnce();
            expect(onChange).toHaveBeenCalledWith(true);
        });

        it('calls onChange with false when toggled from true', () => {
            // Arrange
            const onChange = vi.fn();
            render(
                <ToggleFilter
                    config={baseConfig}
                    value={true}
                    onChange={onChange}
                    locale="es"
                />
            );

            // Act
            fireEvent.click(getSwitch());

            // Assert
            expect(onChange).toHaveBeenCalledOnce();
            expect(onChange).toHaveBeenCalledWith(false);
        });

        it('calls onChange with a boolean value (not any other type)', () => {
            // Arrange
            const onChange = vi.fn();
            render(
                <ToggleFilter
                    config={baseConfig}
                    value={false}
                    onChange={onChange}
                    locale="es"
                />
            );

            // Act
            fireEvent.click(getSwitch());

            // Assert
            expect(typeof onChange.mock.calls[0][0]).toBe('boolean');
        });
    });
});
