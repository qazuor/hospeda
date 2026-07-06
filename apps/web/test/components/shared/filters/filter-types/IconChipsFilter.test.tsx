/**
 * @file IconChipsFilter.test.tsx
 * @description Unit tests for the IconChipsFilter component.
 * Focuses on the "Ver más" (show-more) button's accessible name, which
 * regressed under BETA-125: the hidden-option count was dropped from the
 * aria-label because the `ui.filter.showMore` translation carries no
 * `{{count}}` placeholder for the old `.replace()` to substitute.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IconChipsFilterConfig } from '@/components/shared/filters/filter-types/filter.types';
import { IconChipsFilter } from '@/components/shared/filters/filter-types/IconChipsFilter';

vi.mock('@/components/shared/filters/filter-types/IconChipsFilter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

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
});
