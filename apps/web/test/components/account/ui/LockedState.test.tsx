/**
 * Tests for LockedState (HOS-2413 T-028).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LockedState, type PlanRef } from '../../../../src/components/account/ui';

/** Fixture catalog: the kit receives plan names, it never owns them. */
const CATALOG: readonly PlanRef[] = [{ name: 'Plan Alfa' }, { name: 'Plan Beta' }];

describe('LockedState', () => {
    it('plan: shows the catalog plan names as plan pills and an accent «Ver planes»', () => {
        const { container } = render(
            <LockedState
                locale="es"
                reason={{
                    kind: 'plan',
                    feature: 'Carta',
                    description: 'Mostrá tus platos.',
                    plans: CATALOG,
                    plansHref: '/mi-cuenta/planes/'
                }}
            />
        );
        const pills = [...container.querySelectorAll('.plan')].map((el) => el.textContent);
        expect(pills).toEqual(['Plan Alfa', 'Plan Beta']);
        const link = screen.getByRole('link', { name: 'Ver planes' });
        expect(link).toHaveAttribute('href', '/mi-cuenta/planes/');
        expect(link).toHaveClass('accent');
        expect(screen.getByRole('heading', { level: 3, name: 'Carta' })).toBeInTheDocument();
    });

    it('plan: the trial button is absent unless passed, and runs when passed', async () => {
        const user = userEvent.setup();
        const onStartTrial = vi.fn();
        const base = {
            kind: 'plan' as const,
            feature: 'Carta',
            description: 'x',
            plans: CATALOG,
            plansHref: '/p'
        };
        const { rerender } = render(
            <LockedState
                locale="es"
                reason={base}
            />
        );
        expect(screen.queryByRole('button', { name: 'Empezar prueba' })).toBeNull();
        rerender(
            <LockedState
                locale="es"
                reason={{ ...base, onStartTrial }}
            />
        );
        await user.click(screen.getByRole('button', { name: 'Empezar prueba' }));
        expect(onStartTrial).toHaveBeenCalledTimes(1);
    });

    it('role: an accent join action', () => {
        render(
            <LockedState
                locale="es"
                reason={{
                    kind: 'role',
                    feature: 'Locales',
                    description: 'x',
                    joinHref: '/sumarme'
                }}
            />
        );
        const join = screen.getByRole('link', { name: 'Sumarme' });
        expect(join).toHaveAttribute('href', '/sumarme');
        expect(join).toHaveClass('accent');
    });

    it('permission: no button, only a link', () => {
        render(
            <LockedState
                locale="es"
                reason={{
                    kind: 'permission',
                    feature: 'Equipo',
                    description: 'x',
                    helpHref: '/ayuda'
                }}
            />
        );
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getByRole('link', { name: 'Saber más' })).toHaveAttribute('href', '/ayuda');
    });

    it('never renders an enabled form control', () => {
        const { container } = render(
            <LockedState
                locale="es"
                reason={{
                    kind: 'plan',
                    feature: 'Carta',
                    description: 'x',
                    plans: CATALOG,
                    plansHref: '/p'
                }}
            />
        );
        expect(
            container.querySelectorAll(
                'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
            )
        ).toHaveLength(0);
    });

    it('holds no plan name, price or limit literal in its source', () => {
        const source = readFileSync(
            resolve(__dirname, '../../../../src/components/account/ui/LockedState.tsx'),
            'utf8'
        );
        expect(source).not.toMatch(/\b(Básico|Basico|Premium|Pro)\b|\$\s?\d|ARS/);
    });
});
