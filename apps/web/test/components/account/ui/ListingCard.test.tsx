/**
 * Tests for the kit ListingCard and ListingCardGrid (HOS-2483).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
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

    it('stays a valid list when Astro wraps the cards in <astro-static-slot>', () => {
        // Arrange & Act: an .astro page passing the cards as children has them
        // wrapped in <astro-static-slot>, which a <ul> may not contain.
        const { container } = render(
            <ListingCardGrid label="Mis comercios">
                {createElement(
                    'astro-static-slot',
                    null,
                    <ListingCard
                        vertical="venue"
                        title="Bar"
                    />,
                    <ListingCard
                        vertical="venue"
                        title="Café"
                    />
                )}
            </ListingCardGrid>
        );

        // Assert: no <ul> at the grid root, and both cards are its list items.
        const list = screen.getByRole('list', { name: 'Mis comercios' });
        expect(list.tagName).toBe('DIV');
        expect(container.querySelector('ul > astro-static-slot')).toBeNull();
        const cards = within(list)
            .getAllByRole('listitem')
            .filter((item) => item.hasAttribute('data-vertical'));
        expect(cards).toHaveLength(2);
        for (const card of cards) expect(card.tagName).toBe('DIV');
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

/**
 * HOS-2600: the cards stretched to the tallest card of their row, and the
 * stretch was spread over empty bands (an action row and a footer with nothing
 * in them, divided by borders). The «more actions» menu was clipped by the
 * card's `overflow: hidden`.
 */
describe('ListingCard layout (HOS-2600)', () => {
    const css = readFileSync(
        resolve(__dirname, '../../../../src/components/account/ui/ListingCard.module.css'),
        'utf8'
    );
    /** Body of the first `selector { ... }` rule in the stylesheet. */
    const ruleOf = (selector: string): string => {
        const start = css.indexOf(`${selector} {`);
        expect(start).toBeGreaterThanOrEqual(0);
        return css.slice(start, css.indexOf('}', start));
    };

    it('stretches cards equally while keeping spare space in the body, above actions', () => {
        expect(ruleOf('.grid')).toMatch(/align-items:\s*stretch;/);
        expect(ruleOf('.card')).toMatch(/flex-direction:\s*column;/);
        expect(ruleOf('.body')).toMatch(/flex:\s*1;/);
        expect(ruleOf('.withTile')).toMatch(/grid-template-rows:\s*1fr auto auto;/);
        expect(ruleOf('.heading')).toMatch(/flex-direction:\s*column;/);
    });

    it('does not clip the menu: the card has no overflow hidden, the photo rounds itself', () => {
        expect(ruleOf('.card')).not.toMatch(/overflow:\s*hidden/);
        expect(ruleOf('.media')).toMatch(/overflow:\s*hidden/);
        expect(ruleOf('.media')).toMatch(/border-start-start-radius:\s*inherit/);
        expect(ruleOf('.media')).toMatch(/border-start-end-radius:\s*inherit/);
    });

    it('hides an action row and a footer whose slots rendered nothing', () => {
        expect(css).toMatch(/\.footer:empty\s*\{\s*display:\s*none;/);
        expect(css).toMatch(
            /\.actions:has\(> \.primary:empty:only-child\)\s*\{\s*display:\s*none;/
        );
    });

    it('an Astro slot that renders nothing leaves exactly the empty shape the CSS hides', () => {
        // Arrange: Astro hands a React island one element per declared slot,
        // even when the slot's conditional rendered nothing.
        const Nothing = () => null;

        // Act
        const { container } = render(
            <ListingCard
                as="article"
                vertical="accommodation"
                title="Casa borrada"
                primaryAction={<Nothing />}
                menu={<Nothing />}
                footer={<Nothing />}
            />
        );

        // Assert
        const actions = container.querySelector('.actions');
        expect(actions?.children).toHaveLength(1);
        expect(actions?.firstElementChild).toHaveClass('primary');
        expect(actions?.firstElementChild?.childNodes).toHaveLength(0);
        expect(container.querySelector('.footer')?.childNodes).toHaveLength(0);
    });
});
