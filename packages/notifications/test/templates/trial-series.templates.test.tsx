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

// ---------------------------------------------------------------------------
// The two content checks, as named predicates
// ---------------------------------------------------------------------------
//
// Extracted from the assertions that use them for ONE reason: so the positive
// control at the bottom of this file can feed them a synthetic series in which
// one template's copy WAS pasted into another, and prove they report it.
//
// A guard that has only ever been observed passing has not been shown to be
// capable of failing. That is exactly the shape G-4 exists to prevent in the
// templates themselves, and it applies to the guard just as much.

/** How many of these renders are distinct. Equals the length when all differ. */
function distinctRenderCount(rendered: readonly string[]): number {
    return new Set(rendered).size;
}

/** How many renders contain this phrase. Must be exactly 1 for a fingerprint. */
function fingerprintOwners(rendered: readonly string[], fingerprint: string): number {
    return rendered.filter((html) => html.includes(fingerprint)).length;
}

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
        expect(distinctRenderCount(rendered)).toBe(SERIES.length);
    });

    it('every send says something none of the other eight says', () => {
        // Stronger than uniqueness: a copy-paste with only the heading changed
        // passes the test above and fails this one.
        const rendered = SERIES.map((send) => send.render());

        for (const [index, send] of SERIES.entries()) {
            expect(fingerprintOwners(rendered, send.fingerprint), `${send.name} ownership`).toBe(1);
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

describe('G-4: the guard itself can fail (HOS-1012 T-025)', () => {
    // The positive control. Everything above reports that the nine templates
    // differ today; none of it shows that the checks are CAPABLE of reporting
    // that they do not. A guard only ever observed passing is indistinguishable
    // from a guard that cannot fail — which is the same silence G-4 exists to
    // break in the templates.
    //
    // So: take the real nine, paste one template's copy over another the way a
    // careless copy-paste would, and assert that each check catches it.

    /** The nine real renders, with `victim` replaced by a copy of `source`. */
    function seriesWithCopyPaste(sourceIndex: number, victimIndex: number): string[] {
        const rendered = SERIES.map((send) => send.render());
        rendered[victimIndex] = rendered[sourceIndex] as string;
        return rendered;
    }

    it('the uniqueness check catches a whole template pasted over another', () => {
        // The crude failure: someone duplicates trial-ending-5d.tsx as
        // trial-ending-1d.tsx and forgets to rewrite the body.
        const tampered = seriesWithCopyPaste(1, 2);

        expect(distinctRenderCount(tampered)).toBe(SERIES.length - 1);
        expect(distinctRenderCount(tampered)).not.toBe(SERIES.length);
    });

    it('the ownership check catches copy shared by two sends', () => {
        // The subtler failure, and the one the uniqueness check alone misses:
        // the two renders still differ (a heading was changed) but a phrase
        // that should belong to exactly one send now appears in two.
        const rendered = SERIES.map((send) => send.render());
        const victim = SERIES[4];
        const source = SERIES[5];
        if (!victim || !source) throw new Error('fixture out of range');

        const tampered = [...rendered];
        // Append the +5 fingerprint to the +1 render: the two are still
        // different strings, so uniqueness stays satisfied.
        tampered[4] = `${rendered[4]}<p>${source.fingerprint}</p>`;

        expect(distinctRenderCount(tampered)).toBe(SERIES.length);
        expect(fingerprintOwners(tampered, source.fingerprint)).toBe(2);
        expect(fingerprintOwners(tampered, source.fingerprint)).not.toBe(1);
    });

    it('the promo-code ban catches a commercial hook added to a win-back', () => {
        // OQ-1 is still open, so this one guards a standing decision rather
        // than a style preference: no win-back may offer a discount.
        const banned =
            /descuento|cup[oó]n|promoci[oó]n|c[oó]digo\s+(de\s+)?(promo|descuento)|promo\s*code|bonificaci[oó]n|oferta\s+especial/i;
        const tampered = `${WIN_BACKS[0]?.render()}<p>Te dejamos un 20% de descuento</p>`;

        expect(tampered).toMatch(banned);
    });
});
