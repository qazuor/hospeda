/**
 * Tests for the kit EntityCard and EntityCardGrid (HOS-2480).
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EntityCard, EntityCardGrid } from '../../../../src/components/account/ui';

describe('EntityCard (kit)', () => {
    it('renders a list item with a heading that links to the entity', () => {
        // Arrange & Act
        render(
            <ul>
                <EntityCard
                    locale="es"
                    title="Casa del río"
                    href="/es/alojamientos/casa-del-rio/"
                    meta="Alojamiento"
                />
            </ul>
        );

        // Assert
        const item = screen.getByRole('listitem');
        const heading = within(item).getByRole('heading', { level: 3, name: 'Casa del río' });
        expect(within(heading).getByRole('link')).toHaveAttribute(
            'href',
            '/es/alojamientos/casa-del-rio/'
        );
        expect(within(item).getByText('Alojamiento')).toBeInTheDocument();
    });

    it('renders the image with its alt text', () => {
        render(
            <ul>
                <EntityCard
                    locale="es"
                    title="Casa"
                    image={{ src: 'https://example.test/a.jpg', alt: 'Casa' }}
                />
            </ul>
        );
        expect(screen.getByRole('img', { name: 'Casa' })).toHaveAttribute(
            'src',
            'https://example.test/a.jpg'
        );
        expect(screen.queryByText('Sin imagen')).not.toBeInTheDocument();
    });

    it('shows the translated placeholder when there is no image nor visual', () => {
        render(
            <ul>
                <EntityCard
                    locale="en"
                    title="House"
                />
            </ul>
        );
        expect(screen.getByText('No image')).toBeInTheDocument();
    });

    it('renders a decorative visual instead of the placeholder', () => {
        render(
            <ul>
                <EntityCard
                    locale="es"
                    title="Verano"
                    media={<span data-testid="visual">★</span>}
                />
            </ul>
        );
        expect(screen.getByTestId('visual').parentElement).toHaveAttribute('aria-hidden', 'true');
        expect(screen.queryByText('Sin imagen')).not.toBeInTheDocument();
    });

    it('renders the title as plain text without href, and honours headingLevel', () => {
        render(
            <EntityCard
                as="div"
                locale="es"
                title="Sin link"
                headingLevel={4}
            />
        );
        expect(screen.getByRole('heading', { level: 4, name: 'Sin link' })).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    });

    it('renders children, badge and actions', () => {
        render(
            <ul>
                <EntityCard
                    locale="es"
                    title="Casa"
                    badge={<span>Nuevo</span>}
                    actions={<button type="button">Quitar</button>}
                >
                    <p>Mi nota</p>
                </EntityCard>
            </ul>
        );
        expect(screen.getByText('Nuevo')).toBeInTheDocument();
        expect(screen.getByText('Mi nota')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Quitar' })).toBeInTheDocument();
    });

    it('carries the optional help anchor', () => {
        const { container } = render(
            <ul>
                <EntityCard
                    locale="es"
                    title="Casa"
                    helpId="section:favorites.uncollected"
                />
            </ul>
        );
        expect(
            container.querySelector('[data-help="section:favorites.uncollected"]')
        ).not.toBeNull();
    });
});

describe('EntityCardGrid (kit)', () => {
    it('renders a labelled list of cards', () => {
        render(
            <EntityCardGrid label="Mis favoritos">
                <EntityCard
                    locale="es"
                    title="Uno"
                />
                <EntityCard
                    locale="es"
                    title="Dos"
                />
            </EntityCardGrid>
        );
        const list = screen.getByRole('list', { name: 'Mis favoritos' });
        expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    });
});
