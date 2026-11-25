/**
 * Tests for PageHeader (HOS-2413 T-022).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button, PageHeader, StatusPill } from '../../../../src/components/account/ui';

describe('PageHeader', () => {
    it('omits breadcrumb navigation on a top-level section', () => {
        render(
            <PageHeader
                title="Favoritos"
                locale="es"
            />
        );
        expect(screen.queryByRole('navigation', { name: 'Ruta de navegación' })).toBeNull();
    });
    it('renders exactly one h1: the title', () => {
        render(
            <PageHeader
                title="Mi carta"
                locale="es"
                description="Edit"
                status={
                    <StatusPill
                        tone="success"
                        dot
                    >
                        Publicado
                    </StatusPill>
                }
                actions={<Button>Guardar</Button>}
            />
        );
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mi carta');
        expect(screen.getByText('Publicado')).toBeInTheDocument();
    });

    it('the back link is a real link with a translated accessible name', () => {
        render(
            <PageHeader
                title="x"
                locale="es"
                back={{ label: 'Volver a mis locales', href: '/es/mi-cuenta/locales/' }}
            />
        );
        const back = screen.getByRole('link', { name: /Volver a mis locales/ });
        expect(back).toHaveAttribute('href', '/es/mi-cuenta/locales/');
        expect(back.tagName).toBe('A');
    });

    it('renders shared linked ancestors without home, current page, or JSON-LD', () => {
        const { container } = render(
            <PageHeader
                title="x"
                locale="es"
                breadcrumbs={[
                    { label: 'Mi cuenta', path: 'mi-cuenta' },
                    { label: 'Locales', path: 'mi-cuenta/locales' },
                    { label: 'La Casona' }
                ]}
            />
        );
        expect(screen.getByRole('navigation', { name: 'Ruta de navegación' })).toBeInTheDocument();
        expect(screen.getAllByRole('link')).toHaveLength(2);
        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(2);
        expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/'
        );
        expect(screen.getByRole('link', { name: 'Locales' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/locales/'
        );
        expect(screen.queryByText('La Casona')).not.toBeInTheDocument();
        expect(container.querySelector('script')).toBeNull();
        expect(items.at(-1)).not.toHaveAttribute('aria-current');
        expect(items[0]).not.toHaveAttribute('aria-current');
    });

    it('stacks the actions in a narrow container through its CSS class', () => {
        const { container } = render(
            <PageHeader
                title="x"
                locale="es"
                actions={<Button>Ok</Button>}
            />
        );
        expect(container.querySelector('.actions')).not.toBeNull();
        expect(container.querySelector('.root')).not.toBeNull();
    });

    it('renders the tabs slot under the header', () => {
        render(
            <PageHeader
                title="x"
                locale="es"
                tabs={<div data-testid="tabs" />}
            />
        );
        expect(screen.getByTestId('tabs')).toBeInTheDocument();
    });

    it('renders the help slot once, right after the title, inside the title row (HOS-2546)', () => {
        render(
            <PageHeader
                title="Consultas"
                locale="es"
                help={
                    <a
                        data-testid="help"
                        href="/ayuda/x"
                    >
                        ?
                    </a>
                }
            />
        );
        const heading = screen.getByRole('heading', { level: 1 });
        expect(screen.getAllByTestId('help')).toHaveLength(1);
        expect(heading.nextElementSibling).toContainElement(screen.getByTestId('help'));
    });
});
