/**
 * Tests for the kit ListingCard and ListingCardGrid (HOS-2483).
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    Button,
    ListingCard,
    ListingCardGrid,
    StatusPill
} from '../../../../src/components/account/ui';

describe('ListingCard (kit)', () => {
    it('renders a list item with the title linking to its destination and the status word', () => {
        // Arrange & Act
        render(
            <ListingCardGrid label="Mis propiedades">
                <ListingCard
                    vertical="accommodation"
                    title="Casa del Río"
                    href="/es/mi-cuenta/propiedades/1/editar/"
                    status={<StatusPill tone="success">Publicada</StatusPill>}
                    meta={['Colón', '$ 50.000 por noche']}
                />
            </ListingCardGrid>
        );

        // Assert
        const list = screen.getByRole('list', { name: 'Mis propiedades' });
        const item = within(list).getAllByRole('listitem')[0] as HTMLElement;
        const heading = within(item).getByRole('heading', { level: 3, name: 'Casa del Río' });
        expect(within(heading).getByRole('link')).toHaveAttribute(
            'href',
            '/es/mi-cuenta/propiedades/1/editar/'
        );
        expect(within(item).getByText('Publicada')).toBeInTheDocument();
        expect(within(item).getByText('Colón')).toBeInTheDocument();
        expect(item).toHaveAttribute('data-vertical', 'accommodation');
    });

    it('shows the photo with its alt text, or a decorative tile without one', () => {
        // Arrange & Act
        render(
            <ListingCardGrid label="x">
                <ListingCard
                    vertical="venue"
                    title="Con foto"
                    image={{ src: 'https://example.test/a.jpg', alt: 'Frente del local' }}
                />
                <ListingCard
                    vertical="experience"
                    title="Sin foto"
                />
            </ListingCardGrid>
        );

        // Assert
        expect(screen.getByRole('img', { name: 'Frente del local' })).toHaveAttribute(
            'src',
            'https://example.test/a.jpg'
        );
        expect(screen.getAllByRole('img')).toHaveLength(1);
    });

    it('renders one primary action next to the menu, and no action row without either', () => {
        // Arrange & Act
        const { container } = render(
            <ListingCard
                as="article"
                vertical="accommodation"
                title="Casa"
                primaryAction={<Button>Publicar</Button>}
                menu={<button type="button">Más</button>}
                footer={<p>QR</p>}
            >
                <p>Aviso</p>
            </ListingCard>
        );

        // Assert
        expect(container.querySelector('article')).not.toBeNull();
        expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Más' })).toBeInTheDocument();
        expect(screen.getByText('Aviso')).toBeInTheDocument();
        expect(screen.getByText('QR')).toBeInTheDocument();
    });

    it('leaves the title as plain text without href and supports level 2 headings', () => {
        render(
            <ListingCard
                as="article"
                vertical="venue"
                title="Bar"
                headingLevel={2}
                helpId="section:venue.listado"
            />
        );
        const heading = screen.getByRole('heading', { level: 2, name: 'Bar' });
        expect(within(heading).queryByRole('link')).not.toBeInTheDocument();
        expect(heading.closest('article')).toHaveAttribute('data-help', 'section:venue.listado');
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
