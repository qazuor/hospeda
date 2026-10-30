import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrialEnding2Days } from '../../src/templates/trial/trial-ending-2d.js';
import { TrialEnding5Days } from '../../src/templates/trial/trial-ending-5d.js';
import { TrialEnding10Days } from '../../src/templates/trial/trial-ending-10d.js';
import { TrialEndingToday } from '../../src/templates/trial/trial-ending-today.js';
import type { TrialSeriesEmailProps } from '../../src/templates/trial/trial-series-shared.js';
import { TrialWinBack1Day } from '../../src/templates/trial/trial-win-back-1d.js';
import { TrialWinBack5Days } from '../../src/templates/trial/trial-win-back-5d.js';
import { TrialWinBack15Days } from '../../src/templates/trial/trial-win-back-15d.js';
import { TrialWinBack30Days } from '../../src/templates/trial/trial-win-back-30d.js';
import { TrialWinBack60Days } from '../../src/templates/trial/trial-win-back-60d.js';

const base: TrialSeriesEmailProps = {
    recipientName: 'Ana',
    planName: 'Plan inicial',
    trialEndDate: '2026-10-20',
    upgradeUrl: 'https://example.test/precios',
    productDomain: 'accommodation'
};
const templates = [
    TrialEnding10Days,
    TrialEnding5Days,
    TrialEnding2Days,
    TrialEndingToday,
    TrialWinBack1Day,
    TrialWinBack5Days,
    TrialWinBack15Days,
    TrialWinBack30Days,
    TrialWinBack60Days
];

describe('templates de campañas del trial', () => {
    it('renderiza los tres mensajes nuevos con fecha y enlace', () => {
        for (const template of [TrialEnding2Days, TrialEndingToday, TrialWinBack15Days]) {
            const html = renderToStaticMarkup(template(base));
            expect(html).toContain('20 de octubre de 2026');
            expect(html).toContain(base.upgradeUrl);
        }
    });

    it('nombra las tres verticales y conserva exactamente el texto con una sola vertical', () => {
        for (const template of templates) {
            const html = renderToStaticMarkup(
                template({ ...base, verticals: ['accommodation', 'venue', 'experience'] })
            );
            expect(html).toContain('Alojamiento');
            expect(html).toContain('Comer y salir');
            expect(html).toContain('Experiencias');
            expect(renderToStaticMarkup(template({ ...base, verticals: ['accommodation'] }))).toBe(
                renderToStaticMarkup(template(base))
            );
        }
    });
});
