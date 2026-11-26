/**
 * Tests for the kit DataList and ListRow (HOS-2481).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CountPill, DataList, ListRow } from '../../../../src/components/account/ui';

const uiDir = resolve(__dirname, '../../../../src/components/account/ui');

describe('DataList', () => {
    it('renders a labelled list of rows', () => {
        // Arrange / Act
        render(
            <DataList label="Tus consultas">
                <ListRow title="Cabañas del Río" />
                <ListRow title="Hostel Centro" />
            </DataList>
        );

        // Assert
        const list = screen.getByRole('list', { name: 'Tus consultas' });
        expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    });

    it('is the container the rows adapt to (a 40rem container query)', () => {
        const listCss = readFileSync(resolve(uiDir, 'DataList.module.css'), 'utf8');
        const rowCss = readFileSync(resolve(uiDir, 'ListRow.module.css'), 'utf8');
        expect(listCss).toContain('container-type: inline-size');
        expect(rowCss).toContain('@container (width >= 40rem)');
        expect(rowCss).not.toMatch(/@media[^{}]*(?:width|height)/);
    });

    it('forwards the help anchor as data-help', () => {
        const { container } = render(
            <DataList
                label="L"
                helpId="section:messages.list"
            >
                <ListRow title="A" />
            </DataList>
        );
        expect(container.firstElementChild).toHaveAttribute('data-help', 'section:messages.list');
    });
});

describe('ListRow', () => {
    it('wraps narrow descriptions fully and restricts clamping to wide containers', () => {
        const css = readFileSync(resolve(uiDir, 'ListRow.module.css'), 'utf8');
        const base = css.split('@container (width >= 40rem)')[0];
        const description = base.match(/\.description\s*\{([^}]+)\}/)?.[1];
        expect(description).toContain('display: block');
        expect(description).toContain('overflow-wrap: anywhere');
        expect(description).not.toMatch(/line-clamp|overflow:\s*hidden/);
        expect(css.split('@container (width >= 40rem)')[1]).toMatch(
            /\.description:not\(\.descriptionWrap\)\s*\{[^}]*-webkit-line-clamp: 2/
        );
    });

    it('limits row hover and focus backgrounds to fine hover-capable pointers', () => {
        const css = readFileSync(resolve(uiDir, 'ListRow.module.css'), 'utf8');
        const pointerRules = css.match(
            /@media \(hover: hover\) and \(pointer: fine\)\s*\{([\s\S]*?)\n\}/
        )?.[1];
        expect(pointerRules).toContain('.row:has(.link):hover');
        expect(pointerRules).toContain('.row:focus-within');
        expect(css.replace(pointerRules ?? '', '')).not.toMatch(/\.row[^{}]*:(hover|focus-within)/);
        expect(css).toContain('.link:focus-visible::after');
    });

    it('keeps the full description in the DOM and opts out of clamping explicitly', () => {
        const description = 'A long review remains available to assistive technology.';
        const { rerender } = render(
            <DataList label="Reviews">
                <ListRow
                    title="Review"
                    description={description}
                />
            </DataList>
        );
        expect(screen.getByText(description)).toHaveClass('description');
        expect(screen.getByText(description)).not.toHaveClass('descriptionWrap');
        rerender(
            <DataList label="Reviews">
                <ListRow
                    title="Review"
                    description={description}
                    wrapDescription
                />
            </DataList>
        );
        expect(screen.getByText(description)).toHaveClass('descriptionWrap');
    });

    it('links the title and keeps meta, description and trailing pieces', () => {
        // Arrange / Act
        render(
            <DataList label="L">
                <ListRow
                    href="/es/mi-cuenta/consultas/c1/"
                    title="Cabañas del Río"
                    meta="Cabaña chica"
                    description="Último mensaje"
                    trailing={
                        <CountPill
                            count={3}
                            label="3 sin leer"
                        />
                    }
                />
            </DataList>
        );

        // Assert
        expect(screen.getByRole('link', { name: 'Cabañas del Río' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/consultas/c1/'
        );
        expect(screen.getByText('Cabaña chica')).toBeInTheDocument();
        expect(screen.getByText('Último mensaje')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: '3 sin leer' })).toHaveTextContent('3');
    });

    it('renders no link without href', () => {
        render(
            <DataList label="L">
                <ListRow title="Sin enlace" />
            </DataList>
        );
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('renders up to two actions outside the link', () => {
        render(
            <DataList label="L">
                <ListRow
                    href="#x"
                    title="Fila"
                    actions={[
                        <button
                            key="a"
                            type="button"
                        >
                            Abrir
                        </button>,
                        <button
                            key="b"
                            type="button"
                        >
                            Archivar
                        </button>
                    ]}
                />
            </DataList>
        );
        const link = screen.getByRole('link', { name: 'Fila' });
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(2);
        for (const button of buttons) expect(link.contains(button)).toBe(false);
    });

    it('marks an emphasised row', () => {
        render(
            <DataList label="L">
                <ListRow
                    title="Sin leer"
                    emphasis
                />
            </DataList>
        );
        expect(screen.getByRole('listitem')).toHaveAttribute('data-emphasis', '');
    });
});
