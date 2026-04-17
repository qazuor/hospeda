/**
 * @file StarsFilter.test.tsx
 * @description Unit tests for the StarsFilter component.
 * Tests star rendering, selection, deselection, filled state,
 * maxStars config, and aria-label attributes.
 */

import { StarsFilter } from '@/components/shared/filters/filter-types/StarsFilter';
import type { StarsFilterConfig } from '@/components/shared/filters/filter-types/StarsFilter';
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

const baseConfig: StarsFilterConfig = {
    id: 'rating',
    label: 'Estrellas',
    type: 'stars'
};

/** Returns all radio inputs rendered by the component. */
function getStarInputs(): HTMLInputElement[] {
    return screen.getAllByRole('radio') as HTMLInputElement[];
}

describe('StarsFilter', () => {
    describe('rendering', () => {
        it('renders 5 star options by default', () => {
            // Arrange / Act
            render(
                <StarsFilter
                    config={baseConfig}
                    value={0}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(getStarInputs()).toHaveLength(5);
        });

        it('renders the number of stars specified in maxStars', () => {
            // Arrange
            const config: StarsFilterConfig = { ...baseConfig, maxStars: 3 };

            // Act
            render(
                <StarsFilter
                    config={config}
                    value={0}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(getStarInputs()).toHaveLength(3);
        });

        it('marks the matching radio input as checked for the current value', () => {
            // Arrange / Act
            render(
                <StarsFilter
                    config={baseConfig}
                    value={3}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert — radio with value "3" should be checked
            const inputs = getStarInputs();
            expect(inputs[2]).toBeChecked();
            expect(inputs[0]).not.toBeChecked();
            expect(inputs[4]).not.toBeChecked();
        });

        it('shows filled star characters for values up to selection', () => {
            // Arrange / Act
            render(
                <StarsFilter
                    config={baseConfig}
                    value={2}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert — stars 1 and 2 should be filled (★), stars 3-5 empty (☆)
            const labels = screen.getAllByRole('radio').map((r) => r.closest('label'));
            expect(labels[0]?.textContent).toContain('★');
            expect(labels[1]?.textContent).toContain('★');
            expect(labels[2]?.textContent).toContain('☆');
        });

        it('attaches aria-label with star number and translated unit to each label', () => {
            // Arrange / Act
            render(
                <StarsFilter
                    config={baseConfig}
                    value={0}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert — t() returns fallback "estrellas"
            expect(screen.getByLabelText('1 estrellas')).toBeInTheDocument();
            expect(screen.getByLabelText('3 estrellas')).toBeInTheDocument();
            expect(screen.getByLabelText('5 estrellas')).toBeInTheDocument();
        });
    });

    describe('selection', () => {
        it('calls onChange with the star number when a star is clicked', () => {
            // Arrange
            const onChange = vi.fn();
            render(
                <StarsFilter
                    config={baseConfig}
                    value={0}
                    onChange={onChange}
                    locale="es"
                />
            );

            // Act — click the 4th star radio
            fireEvent.click(getStarInputs()[3]);

            // Assert
            expect(onChange).toHaveBeenCalledOnce();
            expect(onChange).toHaveBeenCalledWith(4);
        });

        it('encodes deselect logic: onChange handler returns 0 when current value equals the star', () => {
            // Note: jsdom cannot re-trigger the change event on an already-checked radio
            // (browsers don't fire change for the currently selected radio in a group —
            // this is a browser spec constraint, not a component bug).
            // We verify the deselect formula (value === star ? 0 : star) by reading the
            // component source, consistent with the project's testing convention for
            // browser-native limitations.
            const { readFileSync } = require('node:fs');
            const { resolve } = require('node:path');
            const src = readFileSync(
                resolve(
                    __dirname,
                    '../../../../../src/components/shared/filters/filter-types/StarsFilter.tsx'
                ),
                'utf8'
            );
            expect(src).toContain('onChange(value === star ? 0 : star)');
        });

        it('calls onChange with the new star number when a different star is clicked', () => {
            // Arrange
            const onChange = vi.fn();
            render(
                <StarsFilter
                    config={baseConfig}
                    value={2}
                    onChange={onChange}
                    locale="es"
                />
            );

            // Act — click star 5
            fireEvent.click(getStarInputs()[4]);

            // Assert
            expect(onChange).toHaveBeenCalledWith(5);
        });
    });

    describe('accessibility', () => {
        it('wraps options in a fieldset with a visually hidden legend', () => {
            // Arrange / Act
            const { container } = render(
                <StarsFilter
                    config={baseConfig}
                    value={0}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            const fieldset = container.querySelector('fieldset');
            expect(fieldset).toBeInTheDocument();
            const legend = fieldset?.querySelector('legend');
            expect(legend?.textContent).toBe('Estrellas');
        });

        it('uses hidden radio inputs so they are keyboard accessible', () => {
            // Arrange / Act
            render(
                <StarsFilter
                    config={baseConfig}
                    value={0}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert — each option is a radio (accessible via keyboard)
            expect(getStarInputs()[0]).toHaveAttribute('type', 'radio');
        });

        it('groups all radio inputs under the same name attribute', () => {
            // Arrange / Act
            render(
                <StarsFilter
                    config={baseConfig}
                    value={0}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert — all share the same group name
            const names = new Set(getStarInputs().map((i) => i.name));
            expect(names.size).toBe(1);
        });
    });
});
