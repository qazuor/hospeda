import { render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
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
const jsonLd = { siteOrigin: 'https://hospeda.test', currentPath: '/es/destinos/colon/eventos/' };

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

    it('renders no nav for a top-level page, but still emits JSON-LD', () => {
        const { container } = render(
            <Breadcrumbs
                {...props}
                items={[{ label: 'Destinos' }]}
                jsonLd={jsonLd}
            />
        );
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
        const data = JSON.parse(container.querySelector('script')?.textContent ?? '');
        expect(data.itemListElement.map((item: { name: string }) => item.name)).toEqual([
            'Inicio',
            'Destinos'
        ]);
    });

    it('renders nothing for an empty trail with structured data disabled', () => {
        const { container } = render(
            <Breadcrumbs
                {...props}
                items={[]}
                jsonLd={false}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('emits structured parents matching visible links, followed by the canonical current page', () => {
        const { container } = render(
            <Breadcrumbs
                {...props}
                jsonLd={jsonLd}
            />
        );
        const data = JSON.parse(
            container.querySelector('script[type="application/ld+json"]')?.textContent ?? ''
        );
        const links = screen.getAllByRole('link');
        expect(
            data.itemListElement
                .slice(0, -1)
                .map((item: { name: string; item: string }) => [item.name, item.item])
        ).toEqual(
            links.map((link) => [
                link.getAttribute('title'),
                `${jsonLd.siteOrigin}${link.getAttribute('href')}`
            ])
        );
        expect(data.itemListElement.at(-1)).toMatchObject({
            name: 'Eventos',
            item: `${jsonLd.siteOrigin}${jsonLd.currentPath}`
        });
    });

    it('marks only the last ancestor for the parent-only mobile presentation', () => {
        render(<Breadcrumbs {...props} />);
        const items = screen.getAllByRole('listitem');
        expect(items.at(-1)).toHaveClass(styles.parent);
        for (const item of items.slice(0, -1)) expect(item).not.toHaveClass(styles.parent);
    });

    it('omits home in both outputs when includeHome is false', () => {
        const { container } = render(
            <Breadcrumbs
                {...props}
                includeHome={false}
                jsonLd={jsonLd}
            />
        );
        expect(screen.queryByRole('link', { name: 'Inicio' })).not.toBeInTheDocument();
        expect(screen.getAllByRole('link')).toHaveLength(2);
        expect(container.querySelector('script')?.textContent).not.toContain('Inicio');
    });

    it('escapes untrusted labels in server-rendered JSON-LD', () => {
        const label = '</script><img src=x onerror=alert(1)> &';
        const html = renderToStaticMarkup(
            <Breadcrumbs
                {...props}
                items={[{ label }]}
                jsonLd={jsonLd}
            />
        );
        expect(html).not.toContain('<img');
        expect(html.match(/<\/script>/g)).toHaveLength(1);
        expect(html).toContain('\\u003c/script\\u003e');
    });
});
