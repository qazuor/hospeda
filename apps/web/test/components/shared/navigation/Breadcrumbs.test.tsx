import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Breadcrumbs } from '../../../../src/components/shared/navigation/Breadcrumbs';
import styles from '../../../../src/components/shared/navigation/Breadcrumbs.module.css';

const props = {
    locale: 'es',
    homeLabel: 'Inicio',
    ariaLabel: 'Ruta de navegación',
    items: [
        { label: 'Destinos', path: 'destinos' },
        { label: 'Dead level' },
        { label: 'Colón', path: 'destinos/colon' },
        { label: 'Eventos' }
    ]
} as const;

describe('Breadcrumbs', () => {
    it('renders a named nav and ordered list of ancestors only with full-label titles', () => {
        render(
            <Breadcrumbs
                {...props}
                className="custom"
            />
        );
        const nav = screen.getByRole('navigation', { name: props.ariaLabel });
        expect(nav).toHaveClass('custom');
        expect(within(nav).getByRole('list').tagName).toBe('OL');
        expect(
            within(nav)
                .getAllByRole('link')
                .map((link) => link.textContent)
        ).toEqual(['‹Inicio', '‹Destinos', '‹Colón']);
        expect(screen.queryByText('Eventos')).not.toBeInTheDocument();
        expect(screen.queryByText('Dead level')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Colón' })).toHaveAttribute('title', 'Colón');
    });

    it.each([
        'Breadcrumb',
        'Navegação estrutural'
    ])('uses the caller-provided localized aria-label: %s', (ariaLabel) => {
        render(
            <Breadcrumbs
                {...props}
                ariaLabel={ariaLabel}
            />
        );
        expect(screen.getByRole('navigation', { name: ariaLabel })).toBeInTheDocument();
    });

    it('renders no nav for a top-level page (single level, D4b)', () => {
        const { container } = render(
            <Breadcrumbs
                {...props}
                items={[{ label: 'Destinos' }]}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('marks only the last ancestor for the parent-only mobile presentation', () => {
        render(<Breadcrumbs {...props} />);
        const items = screen.getAllByRole('listitem');
        expect(items.at(-1)).toHaveClass(styles.parent);
        for (const item of items.slice(0, -1)) expect(item).not.toHaveClass(styles.parent);
    });

    it('omits home when includeHome is false', () => {
        render(
            <Breadcrumbs
                {...props}
                includeHome={false}
            />
        );
        expect(screen.queryByRole('link', { name: 'Inicio' })).not.toBeInTheDocument();
        expect(screen.getAllByRole('link')).toHaveLength(2);
    });
});
