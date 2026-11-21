/**
 * Tests for Switch and SwitchRow (HOS-2413 T-016).
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Switch, SwitchRow } from '../../../../src/components/account/ui';

describe('Switch', () => {
    it('is a switch that Space toggles', async () => {
        const user = userEvent.setup();
        const onCheckedChange = vi.fn();
        render(
            <Switch
                aria-label="Avisos"
                checked={false}
                onCheckedChange={onCheckedChange}
            />
        );
        const control = screen.getByRole('switch', { name: 'Avisos' });
        expect(control).toHaveAttribute('aria-checked', 'false');
        control.focus();
        await user.keyboard(' ');
        expect(onCheckedChange).toHaveBeenCalledWith(true);
    });
});

describe('SwitchRow', () => {
    it('is named by its label and every aria-describedby id exists (HOS-2435)', () => {
        render(
            <SwitchRow
                label="Recibir avisos"
                description="Te escribimos por mail."
                locale="es"
                checked
                onChange={async () => {}}
            />
        );
        const control = screen.getByRole('switch', { name: 'Recibir avisos' });
        for (const id of (control.getAttribute('aria-describedby') ?? '').split(' ')) {
            expect(document.getElementById(id)).not.toBeNull();
        }
        expect(control.getAttribute('aria-describedby')).toBeTruthy();
    });

    it('is disabled and busy while saving', async () => {
        const user = userEvent.setup();
        let finish: () => void = () => {};
        render(
            <SwitchRow
                label="Avisos"
                locale="es"
                checked={false}
                onChange={() => new Promise<void>((resolve) => (finish = resolve))}
            />
        );
        const control = screen.getByRole('switch');
        await user.click(control);
        expect(control).toBeDisabled();
        expect(control).toHaveAttribute('aria-busy', 'true');
        expect(control).toHaveAttribute('aria-checked', 'true');
        finish();
        await waitFor(() => expect(control).not.toBeDisabled());
        expect(control).not.toHaveAttribute('aria-busy');
    });

    it('reverts to the previous value and shows a translated error when the save fails', async () => {
        const user = userEvent.setup();
        render(
            <SwitchRow
                label="Avisos"
                locale="es"
                checked={false}
                onChange={() => Promise.reject(new Error('boom'))}
            />
        );
        const control = screen.getByRole('switch');
        await user.click(control);
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('No se pudo guardar el cambio');
        expect(control).toHaveAttribute('aria-checked', 'false');
        // the error id is part of aria-describedby and exists
        expect(control.getAttribute('aria-describedby')).toContain(alert.id);
    });

    it('locked shows a plan pill and a link, and keeps the switch off and disabled', () => {
        render(
            <SwitchRow
                label="Destacar"
                locale="es"
                checked
                locked={{ planLabel: 'Premium', href: '/mi-cuenta/planes/' }}
                onChange={async () => {}}
            />
        );
        const control = screen.getByRole('switch');
        expect(control).toBeDisabled();
        expect(control).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByText('Premium')).toHaveClass('plan');
        expect(screen.getByRole('link', { name: 'Ver cómo activarlo' })).toHaveAttribute(
            'href',
            '/mi-cuenta/planes/'
        );
    });
});
