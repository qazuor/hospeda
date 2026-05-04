/**
 * @file SettingsDropdown.test.tsx
 * @description Tests the narrow-desktop settings popover for guests.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SettingsDropdown } from '../../../../src/components/shared/navigation/SettingsDropdown.client';

function open() {
    const trigger = screen.getByRole('button', { name: /abrir preferencias/i });
    fireEvent.click(trigger);
    return trigger;
}

describe('SettingsDropdown', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('renders a closed trigger by default', () => {
        render(
            <SettingsDropdown
                locale="es"
                currentPath="/es/"
            />
        );
        const trigger = screen.getByRole('button', { name: /abrir preferencias/i });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens the popover when the trigger is clicked', () => {
        render(
            <SettingsDropdown
                locale="es"
                currentPath="/es/"
            />
        );
        const trigger = open();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes when Escape is pressed', () => {
        render(
            <SettingsDropdown
                locale="es"
                currentPath="/es/"
            />
        );
        const trigger = open();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('contains the language switcher and theme control inside the popover', () => {
        render(
            <SettingsDropdown
                locale="es"
                currentPath="/es/"
            />
        );
        open();
        expect(screen.getByRole('group', { name: /cambiar idioma/i })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /tema de la interfaz/i })).toBeInTheDocument();
    });

    it('renders a sign-in link inside the popover', () => {
        render(
            <SettingsDropdown
                locale="es"
                currentPath="/es/"
            />
        );
        open();
        const signIn = screen.getByRole('link', { name: /iniciar sesión/i });
        expect(signIn).toHaveAttribute('href', '/es/auth/signin/');
    });
});
