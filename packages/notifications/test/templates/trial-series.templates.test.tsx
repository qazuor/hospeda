/**
 * HOS-1012 T-014 / T-015 / T-031 — the nine emails of the trial series are nine
 * different emails.
 *
 * The requirement these tests defend is the one that is easiest to satisfy on
 * paper and hardest to catch when it is not: shipping ONE template nine times.
 * Nine files exist, nine types dispatch, nine subjects render, every structural
 * check passes — and the host receives the same message nine times.
 *
 * So the assertions here are about CONTENT, not structure:
 *
 * 1. Every render is unique (catches literal reuse of a whole template).
 * 2. Every send carries a phrase that appears in exactly one of the nine
 *    (catches a copy-paste with the heading swapped, which assertion 1 misses).
 * 3. The three sends that land inside 48 hours are in three different tenses —
 *    tomorrow, today, yesterday — because those are the ones a host reads back
 *    to back.
 * 4. No win-back mentions a discount, coupon or promo code. OQ-1 is OPEN: a
 *    coupon by directed email is a decision the owner has not made, and the
 *    standing rule is that coupons are never published.
 *
 * @module test/templates/trial-series.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrialEnding1Day } from '../../src/templates/trial/trial-ending-1d';
import { TrialEnding5Days } from '../../src/templates/trial/trial-ending-5d';
import { TrialEnding10Days } from '../../src/templates/trial/trial-ending-10d';
import { TrialExpired } from '../../src/templates/trial/trial-expired';
import type { TrialSeriesEmailProps } from '../../src/templates/trial/trial-series-shared';
import { TrialWinBack1Day } from '../../src/templates/trial/trial-win-back-1d';
import { TrialWinBack5Days } from '../../src/templates/trial/trial-win-back-5d';
import { TrialWinBack10Days } from '../../src/templates/trial/trial-win-back-10d';
import { TrialWinBack30Days } from '../../src/templates/trial/trial-win-back-30d';
import { TrialWinBack60Days } from '../../src/templates/trial/trial-win-back-60d';

const props: TrialSeriesEmailProps = {
    recipientName: 'Marta Giménez',
    planName: 'Plan Anfitrión',
    trialEndDate: '2026-09-26',
    upgradeUrl: 'https://hospeda.com.ar/es/cuenta/planes?interval=monthly'
};

/**
 * The nine sends, in the order a host who never pays lives them.
 *
 * `fingerprint` is a phrase that must appear in THIS send and in none of the
 * other eight. It is what makes assertion 2 non-vacuous: two templates can
 * differ by a single word and still both be "unique renders", but they cannot
 * both own a phrase that says something the other does not.
 */
const SERIES = [
    {
        name: 'T-10',
        render: () => renderToStaticMarkup(TrialEnding10Days(props)),
        fingerprint: '¿Cómo venís con tu publicación?'
    },
    {
        name: 'T-5',
        render: () => renderToStaticMarkup(TrialEnding5Days(props)),
        fingerprint: 'Te quedan 5 días de prueba'
    },
    {
        name: 'T-1',
        render: () => renderToStaticMarkup(TrialEnding1Day(props)),
        fingerprint: 'Mañana tu publicación sale del sitio'
    },
    {
        name: 'day 0',
        render: () => renderToStaticMarkup(TrialExpired(props)),
        fingerprint: 'Tu publicación salió del sitio'
    },
    {
        name: '+1',
        render: () => renderToStaticMarkup(TrialWinBack1Day(props)),
        fingerprint: 'Tu publicación te está esperando'
    },
    {
        name: '+5',
        render: () => renderToStaticMarkup(TrialWinBack5Days(props)),
        fingerprint: 'Volvé a aparecer en Hospeda'
    },
    {
        name: '+10',
        render: () => renderToStaticMarkup(TrialWinBack10Days(props)),
        fingerprint: 'Tus fotos y tus datos siguen guardados'
    },
    {
        name: '+30',
        render: () => renderToStaticMarkup(TrialWinBack30Days(props)),
        fingerprint: '¿Retomamos tu publicación?'
    },
    {
        name: '+60',
        render: () => renderToStaticMarkup(TrialWinBack60Days(props)),
        fingerprint: 'Tu ficha sigue disponible cuando quieras'
    }
] as const;

/** The five win-backs, which OQ-1 constrains. */
const WIN_BACKS = SERIES.slice(4);

describe('the nine trial-series email templates (HOS-1012)', () => {
    it('all nine render without throwing', () => {
        for (const send of SERIES) {
            expect(send.render, send.name).not.toThrow();
        }
    });

    it('all nine greet the host and link to the pricing page', () => {
        for (const send of SERIES) {
            const html = send.render();
            expect(html, send.name).toContain('Marta Giménez');
            expect(html, send.name).toContain(props.upgradeUrl);
        }
    });

    it('no two sends render the same email', () => {
        // Literal reuse of a whole template, given identical props, produces
        // identical markup — this is what catches it.
        const rendered = SERIES.map((send) => send.render());
        expect(new Set(rendered).size).toBe(SERIES.length);
    });

    it('every send says something none of the other eight says', () => {
        // Stronger than uniqueness: a copy-paste with only the heading changed
        // passes the test above and fails this one.
        const rendered = SERIES.map((send) => send.render());

        for (const [index, send] of SERIES.entries()) {
            const owners = rendered.filter((html) => html.includes(send.fingerprint));
            expect(owners.length, `${send.name} fingerprint ownership`).toBe(1);
            expect(rendered[index], send.name).toContain(send.fingerprint);
        }
    });

    it('the three sends inside 48 hours are in three different tenses', () => {
        // T-1, day 0 and +1 arrive within two days of each other. Reading as
        // one message repeated is the specific failure spec section 4 exists to
        // prevent, and tense is where a reader notices it first.
        const tomorrow = renderToStaticMarkup(TrialEnding1Day(props));
        const today = renderToStaticMarkup(TrialExpired(props));
        const yesterday = renderToStaticMarkup(TrialWinBack1Day(props));

        expect(tomorrow).toContain('Mañana');
        expect(tomorrow).not.toContain('Ayer');

        expect(today).toContain('dejó de aparecer');
        expect(today).not.toContain('Mañana');

        expect(yesterday).toContain('Ayer');
        expect(yesterday).not.toContain('Mañana');
    });

    it('the expiry mail reports a fact and the T-1 warns about one', () => {
        // The pair most likely to collapse into each other, asserted on the
        // claim itself rather than on the wording around it.
        const warning = renderToStaticMarkup(TrialEnding1Day(props));
        const report = renderToStaticMarkup(TrialExpired(props));

        expect(warning).toContain('sale del sitio');
        expect(report).toContain('salió del sitio');
        expect(report).toContain('No se borró nada');
    });

    it('the expiry mail carries no unsubscribe link, being transactional', () => {
        // Its eight siblings are REMINDER and opt-out-able; this one is not.
        const report = renderToStaticMarkup(TrialExpired(props));
        expect(report).not.toContain('Administrar preferencias de notificaciones');

        for (const send of SERIES.filter((s) => s.name !== 'day 0')) {
            expect(send.render(), send.name).toContain(
                'Administrar preferencias de notificaciones'
            );
        }
    });

    it('no win-back offers a discount, coupon or promo code (OQ-1 open)', () => {
        const banned =
            /descuento|cup[oó]n|promoci[oó]n|c[oó]digo\s+(de\s+)?(promo|descuento)|promo\s*code|bonificaci[oó]n|oferta\s+especial/i;

        for (const send of WIN_BACKS) {
            expect(send.render(), `${send.name} must not carry a commercial hook`).not.toMatch(
                banned
            );
        }
    });

    it('the last send says it is the last one', () => {
        // A series that simply stops leaves the host waiting for the next mail.
        const last = renderToStaticMarkup(TrialWinBack60Days(props));
        expect(last).toContain('último mail');
    });
});
