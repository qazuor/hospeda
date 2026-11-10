/**
 * HOS-2078 - the "del plan X" fragment is optional.
 *
 * The outbox path never knows the plan, so templates must read naturally without
 * one, and must keep their current wording when a caller does pass one.
 *
 * @module test/templates/trial-series-plan-name.templates.test
 */

import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrialEnding1Day } from '../../src/templates/trial/trial-ending-1d';
import { TrialEnding2Days } from '../../src/templates/trial/trial-ending-2d';
import { TrialEnding5Days } from '../../src/templates/trial/trial-ending-5d';
import { TrialEnding10Days } from '../../src/templates/trial/trial-ending-10d';
import { TrialEndingToday } from '../../src/templates/trial/trial-ending-today';
import { TrialExpired } from '../../src/templates/trial/trial-expired';
import type { TrialSeriesEmailProps } from '../../src/templates/trial/trial-series-shared';
import { TrialWinBack1Day } from '../../src/templates/trial/trial-win-back-1d';

const base: TrialSeriesEmailProps = {
    recipientName: 'Marta',
    trialEndDate: '2026-12-07',
    upgradeUrl: 'https://hospeda.test/es/planes/anfitriones/precios/'
};

const cases: ReadonlyArray<{
    readonly name: string;
    readonly render: (props: TrialSeriesEmailProps) => ReactElement;
    readonly withPlan: string;
}> = [
    {
        name: 'T-10',
        render: TrialEnding10Days,
        withPlan: 'Tu prueba gratis del plan Plan Pro termina el'
    },
    { name: 'T-5', render: TrialEnding5Days, withPlan: 'Plan Pro' },
    {
        name: 'T-2',
        render: TrialEnding2Days,
        withPlan: 'En dos días termina tu prueba del plan Plan Pro.'
    },
    {
        name: 'T-1',
        render: TrialEnding1Day,
        withPlan: 'termina tu prueba gratis del plan <strong>Plan Pro</strong>'
    },
    {
        name: 'T-0',
        render: TrialEndingToday,
        withPlan: 'termina tu prueba gratis del plan Plan Pro.'
    },
    {
        name: 'expired',
        render: TrialExpired,
        withPlan: 'terminó tu prueba gratis del plan <strong>Plan Pro</strong>'
    },
    { name: 'win-back 1d', render: TrialWinBack1Day, withPlan: 'Elegís el plan Plan Pro' }
];

describe('trial series without a plan name', () => {
    it.each(cases)('$name omits the plan fragment', ({ render }) => {
        const html = renderToStaticMarkup(render(base));
        expect(html).not.toContain('del plan');
        expect(html).not.toContain('undefined');
    });

    it('T-10 reads "Tu prueba gratis termina el 7 de diciembre de 2026."', () => {
        const html = renderToStaticMarkup(TrialEnding10Days(base));
        expect(html).toContain('Tu prueba gratis termina el 7 de diciembre de 2026.');
    });
});

describe('trial series with a plan name', () => {
    it.each(cases)('$name keeps the plan fragment', ({ render, withPlan }) => {
        const html = renderToStaticMarkup(render({ ...base, planName: 'Plan Pro' }));
        expect(html).toContain(withPlan);
    });
});

describe('trial series greeting', () => {
    it.each(cases)('$name greets a nameless account as "Hola,"', ({ render }) => {
        const html = renderToStaticMarkup(render({ ...base, recipientName: null }));
        expect(html).toContain('Hola,');
        expect(html).not.toContain('Hola null');
    });

    it('greets a named account with the name', () => {
        expect(renderToStaticMarkup(TrialEnding10Days(base))).toContain('Hola Marta,');
    });
});
