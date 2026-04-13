/**
 * @file SelectSearchFilter.test.tsx
 * @description Unit tests for the SelectSearchFilter component.
 * Tests option rendering, search filtering, multi-select behavior,
 * chip display/removal, and "show more / show less" pagination.
 */

import { SelectSearchFilter } from '@/components/shared/filter-types/SelectSearchFilter';
import type { SelectSearchFilterConfig } from '@/components/shared/filter-types/SelectSearchFilter';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

/** Generates an array of N options with deterministic value/label. */
function makeOptions(n: number) {
    return Array.from({ length: n }, (_, i) => ({
        value: `opt-${i + 1}`,
        label: `Opción ${i + 1}`
    }));
}

const baseConfig: SelectSearchFilterConfig = {
    id: 'amenities',
    label: 'Amenidades',
    type: 'select-search',
    options: makeOptions(5)
};

describe('SelectSearchFilter', () => {
    describe('rendering', () => {
        it('renders all options as checkboxes', () => {
            // Arrange / Act
            render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(screen.getAllByRole('checkbox')).toHaveLength(5);
        });

        it('renders option labels', () => {
            // Arrange / Act
            render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            for (const opt of baseConfig.options) {
                expect(screen.getByText(opt.label)).toBeInTheDocument();
            }
        });

        it('renders a search input', () => {
            // Arrange / Act
            render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert — t() returns fallback "Buscar..."
            expect(screen.getByRole('textbox', { name: 'Buscar...' })).toBeInTheDocument();
        });

        it('does not render chips when nothing is selected', () => {
            // Arrange / Act
            const { container } = render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert — chips container only renders when selectedOptions.length > 0
            expect(container.querySelector('[aria-label="seleccionados"]')).not.toBeInTheDocument();
        });
    });

    describe('search filtering', () => {
        it('hides options that do not match the search text', () => {
            // Arrange
            render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Act
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Opción 2' } });

            // Assert
            expect(screen.getAllByRole('checkbox')).toHaveLength(1);
            expect(screen.getByText('Opción 2')).toBeInTheDocument();
        });

        it('shows all options when search text is cleared', () => {
            // Arrange
            render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Opción 1' } });

            // Act
            fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });

            // Assert
            expect(screen.getAllByRole('checkbox')).toHaveLength(5);
        });

        it('is case-insensitive when filtering', () => {
            // Arrange
            render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Act — lowercase search for uppercase label
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'opción 3' } });

            // Assert
            expect(screen.getAllByRole('checkbox')).toHaveLength(1);
            expect(screen.getByText('Opción 3')).toBeInTheDocument();
        });

        it('shows no checkboxes when search matches nothing', () => {
            // Arrange
            render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Act
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'zzz-no-match' }
            });

            // Assert
            expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
        });
    });

    describe('selection', () => {
        it('checks the checkbox for a selected value', () => {
            // Arrange / Act
            render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={['opt-2']}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
            expect(checkboxes[1]).toBeChecked();
            expect(checkboxes[0]).not.toBeChecked();
        });

        it('calls onChange adding the option when an unchecked checkbox is clicked', () => {
            // Arrange
            const onChange = vi.fn();
            render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={[]}
                    onChange={onChange}
                    locale="es"
                />
            );

            // Act
            fireEvent.click(screen.getAllByRole('checkbox')[0]);

            // Assert
            expect(onChange).toHaveBeenCalledOnce();
            expect(onChange).toHaveBeenCalledWith(['opt-1']);
        });

        it('calls onChange removing the option when a checked checkbox is clicked', () => {
            // Arrange
            const onChange = vi.fn();
            render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={['opt-1', 'opt-3']}
                    onChange={onChange}
                    locale="es"
                />
            );

            // Act — uncheck opt-1
            fireEvent.click(screen.getAllByRole('checkbox')[0]);

            // Assert
            expect(onChange).toHaveBeenCalledWith(['opt-3']);
        });

        it('preserves existing selections when adding a new one', () => {
            // Arrange
            const onChange = vi.fn();
            render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={['opt-2']}
                    onChange={onChange}
                    locale="es"
                />
            );

            // Act — also select opt-4
            fireEvent.click(screen.getAllByRole('checkbox')[3]);

            // Assert
            expect(onChange).toHaveBeenCalledWith(['opt-2', 'opt-4']);
        });
    });

    describe('chips', () => {
        it('renders a chip for each selected option', () => {
            // Arrange / Act
            const { container } = render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={['opt-1', 'opt-3']}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            const chipsContainer = container.querySelector('[aria-label="seleccionados"]');
            expect(chipsContainer).toBeInTheDocument();
            const chipButtons = within(chipsContainer as HTMLElement).getAllByRole('button');
            expect(chipButtons).toHaveLength(2);
        });

        it('chip button text matches the option label', () => {
            // Arrange / Act
            const { container } = render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={['opt-2']}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            const chipsContainer = container.querySelector('[aria-label="seleccionados"]');
            expect(
                within(chipsContainer as HTMLElement).getByRole('button', {
                    name: /Quitar filtro.*Opción 2/i
                })
            ).toBeInTheDocument();
        });

        it('calls onChange removing the option when a chip is clicked', () => {
            // Arrange
            const onChange = vi.fn();
            const { container } = render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={['opt-1', 'opt-3']}
                    onChange={onChange}
                    locale="es"
                />
            );

            // Act — click the first chip (opt-1)
            const chipsContainer = container.querySelector('[aria-label="seleccionados"]');
            const firstChip = within(chipsContainer as HTMLElement).getAllByRole('button')[0];
            fireEvent.click(firstChip);

            // Assert
            expect(onChange).toHaveBeenCalledWith(['opt-3']);
        });
    });

    describe('show more / show less', () => {
        it('does not render "Ver más" button when options do not exceed maxVisible', () => {
            // Arrange — 5 options, default maxVisible=8
            render(
                <SelectSearchFilter
                    config={baseConfig}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(screen.queryByRole('button', { name: /ver más/i })).not.toBeInTheDocument();
        });

        it('renders "Ver más" button when options exceed maxVisible', () => {
            // Arrange — 10 options, maxVisible=5
            const config: SelectSearchFilterConfig = {
                ...baseConfig,
                options: makeOptions(10),
                maxVisible: 5
            };

            render(
                <SelectSearchFilter
                    config={config}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert — t() returns fallback "Ver más"
            expect(screen.getByRole('button', { name: 'Ver más' })).toBeInTheDocument();
        });

        it('shows only maxVisible options before "Ver más" is clicked', () => {
            // Arrange
            const config: SelectSearchFilterConfig = {
                ...baseConfig,
                options: makeOptions(10),
                maxVisible: 5
            };

            render(
                <SelectSearchFilter
                    config={config}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert — only 5 checkboxes visible (plus the "Ver más" button, not a checkbox)
            expect(screen.getAllByRole('checkbox')).toHaveLength(5);
        });

        it('shows all options after "Ver más" is clicked', () => {
            // Arrange
            const config: SelectSearchFilterConfig = {
                ...baseConfig,
                options: makeOptions(10),
                maxVisible: 5
            };

            render(
                <SelectSearchFilter
                    config={config}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Act
            fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));

            // Assert
            expect(screen.getAllByRole('checkbox')).toHaveLength(10);
        });

        it('shows "Ver menos" button after "Ver más" is clicked', () => {
            // Arrange
            const config: SelectSearchFilterConfig = {
                ...baseConfig,
                options: makeOptions(10),
                maxVisible: 5
            };

            render(
                <SelectSearchFilter
                    config={config}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );
            fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));

            // Assert
            expect(screen.getByRole('button', { name: 'Ver menos' })).toBeInTheDocument();
        });

        it('collapses back to maxVisible options when "Ver menos" is clicked', () => {
            // Arrange
            const config: SelectSearchFilterConfig = {
                ...baseConfig,
                options: makeOptions(10),
                maxVisible: 5
            };

            render(
                <SelectSearchFilter
                    config={config}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );
            fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
            expect(screen.getAllByRole('checkbox')).toHaveLength(10);

            // Act
            fireEvent.click(screen.getByRole('button', { name: 'Ver menos' }));

            // Assert
            expect(screen.getAllByRole('checkbox')).toHaveLength(5);
        });
    });
});
