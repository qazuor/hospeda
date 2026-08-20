/**
 * @file PublishMenu.test.tsx
 * @description Tests the header "Publicar" CTA dropdown (HOS-691) — the
 * three-way chooser (accommodation / gastronomy / experience) that replaced
 * the single `/publicar/` link in Header.astro.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PublishMenu } from '../../../../src/components/shared/navigation/PublishMenu.client';

function open() {
    const trigger = screen.getByRole('button', { name: /publicar/i });
    fireEvent.click(trigger);
    return trigger;
}

describe('PublishMenu', () => {
    it('renders a closed trigger by default', () => {
        render(<PublishMenu locale="es" />);
        const trigger = screen.getByRole('button', { name: /publicar/i });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('opens a role="menu" panel when the trigger is clicked (HOS-691 AC-12)', () => {
        render(<PublishMenu locale="es" />);
        const trigger = open();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('menu', { name: /publicar/i })).toBeInTheDocument();
    });

    it('renders exactly three options: accommodation, gastronomy, experience (AC-38)', () => {
        render(<PublishMenu locale="es" />);
        open();
        const items = screen.getAllByRole('menuitem');
        expect(items).toHaveLength(3);
        expect(screen.getByRole('menuitem', { name: /alojamiento/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /gastronomía/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /experiencias/i })).toBeInTheDocument();
    });

    it('links each option to its discovery-doors.ts href, locale-prefixed (AC-38)', () => {
        render(<PublishMenu locale="es" />);
        open();
        expect(screen.getByRole('menuitem', { name: /alojamiento/i })).toHaveAttribute(
            'href',
            '/es/publicar/'
        );
        expect(screen.getByRole('menuitem', { name: /gastronomía/i })).toHaveAttribute(
            'href',
            '/es/publicar-restaurante/'
        );
        expect(screen.getByRole('menuitem', { name: /experiencias/i })).toHaveAttribute(
            'href',
            '/es/publicar-experiencia/'
        );
    });

    it('closes when Escape is pressed and returns focus to the trigger', () => {
        render(<PublishMenu locale="es" />);
        const trigger = open();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it('closes when clicking outside the menu', () => {
        render(
            <div>
                <PublishMenu locale="es" />
                <button type="button">outside</button>
            </div>
        );
        const trigger = open();
        fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes when an option is clicked', () => {
        render(<PublishMenu locale="es" />);
        const trigger = open();
        fireEvent.click(screen.getByRole('menuitem', { name: /alojamiento/i }));
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('translates the trigger and option labels in en', () => {
        render(<PublishMenu locale="en" />);
        const trigger = screen.getByRole('button', { name: /publish/i });
        fireEvent.click(trigger);
        expect(screen.getByRole('menuitem', { name: /accommodation/i })).toHaveAttribute(
            'href',
            '/en/publicar/'
        );
    });

    it('applies the passed className to the trigger (Header.astro relies on this for header__cta CSS)', () => {
        render(
            <PublishMenu
                locale="es"
                className="header__cta"
            />
        );
        expect(screen.getByRole('button', { name: /publicar/i })).toHaveClass('header__cta');
    });
});
