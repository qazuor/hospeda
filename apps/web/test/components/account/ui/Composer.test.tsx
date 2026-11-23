/**
 * Tests for the kit Composer (HOS-2481): it never submits natively (HOS-2439),
 * clears at once, sends with Ctrl+Enter, and uses the 16px kit control.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from '../../../../src/components/account/ui';

const uiDir = resolve(__dirname, '../../../../src/components/account/ui');

describe('Composer', () => {
    it('sends the trimmed text, clears and keeps focus, without a native submit', async () => {
        // Arrange
        const user = userEvent.setup();
        const onSend = vi.fn();
        render(
            <Composer
                locale="es"
                onSend={onSend}
            />
        );
        const box = screen.getByRole('textbox', { name: 'Tu mensaje' });

        // Act
        await user.type(box, '  Hola  ');
        const form = box.closest('form') as HTMLFormElement;
        const submit = new Event('submit', { bubbles: true, cancelable: true });
        act(() => {
            form.dispatchEvent(submit);
        });

        // Assert
        expect(submit.defaultPrevented).toBe(true);
        expect(onSend).toHaveBeenCalledWith({ body: 'Hola' });
        expect(box).toHaveValue('');
        expect(box).toHaveFocus();
    });

    it('does not send an empty or blank text', async () => {
        const user = userEvent.setup();
        const onSend = vi.fn();
        render(
            <Composer
                locale="es"
                onSend={onSend}
            />
        );
        const send = screen.getByRole('button', { name: 'Enviar' });
        expect(send).toBeDisabled();
        await user.type(screen.getByRole('textbox'), '   ');
        expect(send).toBeDisabled();
        expect(onSend).not.toHaveBeenCalled();
    });

    it('sends with Ctrl+Enter and keeps Enter for a new line', async () => {
        const user = userEvent.setup();
        const onSend = vi.fn();
        render(
            <Composer
                locale="es"
                onSend={onSend}
            />
        );
        const box = screen.getByRole('textbox');
        await user.type(box, 'Línea{Enter}otra');
        expect(onSend).not.toHaveBeenCalled();
        fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
        expect(onSend).toHaveBeenCalledWith({ body: 'Línea\notra' });
    });

    it('shows an error as an alert tied to the text box', () => {
        render(
            <Composer
                locale="es"
                onSend={() => undefined}
                error="No se pudo enviar el mensaje."
            />
        );
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('No se pudo enviar el mensaje.');
        expect(screen.getByRole('textbox').getAttribute('aria-describedby')).toContain(alert.id);
    });

    it('blocks sending while disabled', async () => {
        const user = userEvent.setup();
        render(
            <Composer
                locale="es"
                onSend={() => undefined}
                disabled
            />
        );
        await user.type(screen.getByRole('textbox'), 'Hola');
        expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    });

    it('uses the 16px kit control and a 44px send button (HOS-2439)', () => {
        // Arrange / Act
        render(
            <Composer
                locale="es"
                onSend={() => undefined}
            />
        );

        // Assert: the text box is the kit control, whose text is the 16px body token.
        expect(screen.getByRole('textbox').className).toContain('control');
        const control = readFileSync(resolve(uiDir, 'Control.module.css'), 'utf8');
        const block = control.match(/\.control\s*\{([^}]*)\}/)?.[1] ?? '';
        expect(block).toContain('font: var(--app-body)');
        expect(screen.getByRole('button', { name: 'Enviar' }).className).toMatch(/lg/);
    });

    it('sticks to the bottom with the safe-area inset', () => {
        const css = readFileSync(resolve(uiDir, 'Composer.module.css'), 'utf8');
        expect(css).toContain('position: sticky');
        expect(css).toContain('env(safe-area-inset-bottom)');
    });
});
