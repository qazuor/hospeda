/**
 * @file IconChipsFilter.test.tsx
 * @description Unit tests for the IconChipsFilter component.
 * Focuses on the "Ver más" (show-more) button's accessible name, which
 * regressed under BETA-125: the hidden-option count was dropped from the
 * aria-label because the `ui.filter.showMore` translation carries no
 * `{{count}}` placeholder for the old `.replace()` to substitute.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IconChipsFilterConfig } from '@/components/shared/filters/filter-types/filter.types';
import { IconChipsFilter } from '@/components/shared/filters/filter-types/IconChipsFilter';

vi.mock('@/components/shared/filters/filter-types/IconChipsFilter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

/** Mock showModal/close so JSDOM exposes the dialog's children in the a11y tree. */
function setupDialogMocks() {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute('open');
    });
}

/** Builds a config with `count` plain (icon-less) options and the given maxVisible. */
function makeConfig(count: number, maxVisible: number): IconChipsFilterConfig {
    return {
        id: 'amenities',
        label: 'Comodidades',
        type: 'icon-chips',
        maxVisible,
        options: Array.from({ length: count }, (_, i) => ({
            value: `opt-${i}`,
            label: `Opción ${i}`
        }))
    };
}

describe('IconChipsFilter', () => {
    describe('show-more button (BETA-125 regression)', () => {
        it('includes the hidden-option count in the accessible name', () => {
            // Arrange: 13 options, 10 visible → 3 hidden.
            render(
                <IconChipsFilter
                    config={makeConfig(13, 10)}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Act
            const showMore = screen.getByRole('button', { name: /ver más/i });

            // Assert: the count (3) must survive into the accessible name.
            expect(showMore).toHaveAccessibleName(/\+3\b/);
            expect(showMore.getAttribute('aria-label')).not.toContain('{{count}}');
        });

        it('does not render a show-more button when nothing is hidden', () => {
            // Arrange: fewer options than maxVisible → no overflow.
            render(
                <IconChipsFilter
                    config={makeConfig(4, 10)}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            // Assert
            expect(screen.queryByRole('button', { name: /ver más/i })).not.toBeInTheDocument();
        });
    });

    describe('dialog search (HOS-979 diacritic-insensitive filtering)', () => {
        beforeEach(() => {
            setupDialogMocks();
        });

        /** A config with an accented option kept out of the visible chips. */
        const CABIN_CONFIG: IconChipsFilterConfig = {
            id: 'amenities',
            label: 'Comodidades',
            type: 'icon-chips',
            maxVisible: 1,
            options: [
                { value: 'wifi', label: 'WiFi' },
                { value: 'cabin', label: 'Cabaña' }
            ]
        };

        it('finds "Cabaña" when the visitor types "cabana" without the accent', () => {
            render(
                <IconChipsFilter
                    config={CABIN_CONFIG}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            fireEvent.click(screen.getByRole('button', { name: /ver más/i }));
            fireEvent.change(screen.getByRole('textbox', { name: /buscar/i }), {
                target: { value: 'cabana' }
            });

            // Scoped to the dialog: the "WiFi" chip also exists as an
            // always-visible inline chip outside the dialog, unaffected by
            // the dialog's own search filter.
            const dialog = within(screen.getByRole('dialog'));
            expect(dialog.getByRole('button', { name: 'Cabaña' })).toBeInTheDocument();
            expect(dialog.queryByRole('button', { name: 'WiFi' })).not.toBeInTheDocument();
        });

        it('negative control: a non-existent term still yields zero dialog results', () => {
            render(
                <IconChipsFilter
                    config={CABIN_CONFIG}
                    value={[]}
                    onChange={vi.fn()}
                    locale="es"
                />
            );

            fireEvent.click(screen.getByRole('button', { name: /ver más/i }));
            fireEvent.change(screen.getByRole('textbox', { name: /buscar/i }), {
                target: { value: 'zzzzznoexiste' }
            });

            expect(
                within(screen.getByRole('dialog')).getByText('Sin resultados')
            ).toBeInTheDocument();
        });
    });
});
