/**
 * Tests for AccountFooter (HOS-2413 T-018, two rows since HOS-2550).
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AccountFooter } from '../../../../src/components/account/ui';

describe('AccountFooter', () => {
    it('row 1: the logo and the Explorar, Para vos and Ayuda groups', () => {
        // Arrange
        const { container } = render(
            <AccountFooter
                locale="es"
                year={2026}
                logoSrc="/logo.webp"
            />
        );

        // Act
        const nav = screen.getByRole('navigation', { name: 'Enlaces del sitio' });
        const headings = within(nav)
            .getAllByRole('heading')
            .map((heading) => heading.textContent);

        // Assert
        expect(headings).toEqual(['Explorar', 'Para vos', 'Ayuda']);
        expect(within(nav).getAllByRole('link')).toHaveLength(7);
        expect(screen.getByRole('link', { name: 'Centro de ayuda' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/ayuda/'
        );
        expect(container.querySelector('img')).toHaveAttribute('src', '/logo.webp');
    });

    it('row 2: the three legal links and the copyright', () => {
        render(
            <AccountFooter
                locale="es"
                year={2026}
            />
        );
        const legal = screen.getByRole('list', { name: 'Enlaces legales' });
        expect(within(legal).getAllByRole('link')).toHaveLength(3);
        expect(within(legal).getByRole('link', { name: /Términos/i })).toHaveAttribute(
            'href',
            '/es/legal/terminos/'
        );
        expect(screen.getByRole('contentinfo')).toHaveTextContent('© 2026 Hospeda.');
    });

    it('renders no image without a logo source, keeping the home link', () => {
        const { container } = render(
            <AccountFooter
                locale="es"
                year={2026}
            />
        );
        expect(container.querySelector('img')).toBeNull();
        expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/es/');
    });

    it('translates the copy', () => {
        render(
            <AccountFooter
                locale="en"
                year={2026}
            />
        );
        expect(screen.getByRole('contentinfo').textContent).toMatch(/rights reserved/i);
        expect(screen.getByRole('link', { name: 'Help center' })).toHaveAttribute(
            'href',
            '/en/mi-cuenta/ayuda/'
        );
    });
});
