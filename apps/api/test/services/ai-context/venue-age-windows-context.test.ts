/**
 * Tests for the resolved minimum-age windows of the venue chat (HOS-2098).
 *
 * The owner decided (10/11/2026) that the chat context carries the scope
 * already resolved against the opening hours, so the model never interprets
 * "Rige desde las 00:00". This file pins the arithmetic and, above all, the
 * conservative fallbacks: nothing here may print a window without a minimum
 * age unless it was computed from a readable shift before the scope time.
 */

import { describe, expect, it } from 'vitest';
import {
    OWNER_DATA_DELIMITER_END,
    OWNER_DATA_DELIMITER_START
} from '../../../src/services/ai-context/owner-data-fence.js';
import {
    AGE_WINDOWS_LABEL,
    type AgeWindowsScope,
    buildVenueAgeWindowLines
} from '../../../src/services/ai-context/venue-age-windows-context.js';

type Shift = { readonly open: string; readonly close: string };

const CLOSED = { closed: true, shifts: [] } as const;

/** A week closed every day except the ones given. */
function week(open: Partial<Record<string, readonly Shift[]>>, timezone?: string) {
    const days: Record<string, unknown> = {};
    for (const key of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
        const shifts = open[key];
        days[key] = shifts ? { closed: false, shifts } : CLOSED;
    }
    return { timezone: timezone ?? 'America/Argentina/Buenos_Aires', days };
}

const fromTime = (from: string): AgeWindowsScope => ({ kind: 'from_time', from, area: null });

function linesFor(
    scope: AgeWindowsScope,
    openingHours: unknown,
    locale: 'es' | 'en' | 'pt' = 'es'
): readonly string[] {
    return buildVenueAgeWindowLines({ minAge: 18, scope, openingHours, locale }).lines;
}

const BAR_21_03 = week({
    fri: [{ open: '21:00', close: '03:00' }],
    sat: [{ open: '21:00', close: '03:00' }]
});

const FREE_ES = 'sin edad mínima informada';

describe('buildVenueAgeWindowLines — from_time', () => {
    it('scope 00:00 is midnight: the evening is free, the hours after midnight are covered', () => {
        // Act
        const lines = linesFor(fromTime('00:00'), BAR_21_03);

        // Assert
        expect(lines[0]).toContain(AGE_WINDOWS_LABEL);
        expect(lines).toEqual([
            lines[0],
            `- Viernes de 21:00 a 00:00 (medianoche): ${FREE_ES}`,
            '- Viernes, pasada la medianoche, de 00:00 a 03:00: edad mínima 18',
            `- Sábado de 21:00 a 00:00 (medianoche): ${FREE_ES}`,
            '- Sábado, pasada la medianoche, de 00:00 a 03:00: edad mínima 18'
        ]);
    });

    it('scope 23:30 cuts the evening and the covered window runs past midnight', () => {
        const lines = linesFor(fromTime('23:30'), BAR_21_03);
        expect(lines).toContain(`- Sábado de 21:00 a 23:30: ${FREE_ES}`);
        expect(lines).toContain('- Sábado de 23:30 a 03:00 (pasada la medianoche): edad mínima 18');
    });

    it('handles several shifts per day: lunch outside, the late-night shift covered', () => {
        // A Friday shift stored as 00:30–05:30 is the night, not Friday morning.
        const hours = week({
            fri: [
                { open: '12:00', close: '15:30' },
                { open: '00:30', close: '05:30' }
            ]
        });
        expect(linesFor(fromTime('00:00'), hours).slice(1)).toEqual([
            `- Viernes de 12:00 a 15:30: ${FREE_ES}`,
            '- Viernes, pasada la medianoche, de 00:30 a 05:30: edad mínima 18'
        ]);
    });

    it('a shift that does not reach the scope time is outside it whole', () => {
        const hours = week({ tue: [{ open: '12:00', close: '15:30' }] });
        expect(linesFor(fromTime('20:00'), hours).slice(1)).toEqual([
            `- Martes de 12:00 a 15:30: ${FREE_ES}`
        ]);
    });

    it('a shift that starts at or after the scope time is covered whole', () => {
        const hours = week({ sat: [{ open: '22:00', close: '02:00' }] });
        expect(linesFor(fromTime('21:00'), hours).slice(1)).toEqual([
            '- Sábado de 22:00 a 02:00 (pasada la medianoche): edad mínima 18'
        ]);
        expect(linesFor(fromTime('22:00'), hours).slice(1)).toEqual([
            '- Sábado de 22:00 a 02:00 (pasada la medianoche): edad mínima 18'
        ]);
    });

    it('a shift that ends exactly at the scope time is outside it whole', () => {
        const hours = week({ sat: [{ open: '18:00', close: '00:00' }] });
        expect(linesFor(fromTime('00:00'), hours).slice(1)).toEqual([
            `- Sábado de 18:00 a 00:00 (medianoche): ${FREE_ES}`
        ]);
    });

    it('a scope after midnight covers only the hours after it', () => {
        const lines = linesFor(fromTime('02:00'), BAR_21_03);
        expect(lines).toContain(`- Sábado de 21:00 a 02:00 (pasada la medianoche): ${FREE_ES}`);
        expect(lines).toContain('- Sábado, pasada la medianoche, de 02:00 a 03:00: edad mínima 18');
    });

    it('a 24-hour day keeps its early-morning hours covered (they belong to the night)', () => {
        const hours = week({ mon: [{ open: '00:00', close: '23:59' }] });
        expect(linesFor(fromTime('20:00'), hours).slice(1)).toEqual([
            `- Lunes de 06:00 a 20:00: ${FREE_ES}`,
            '- Lunes de 20:00 a 23:59: edad mínima 18',
            '- Lunes, pasada la medianoche, de 00:00 a 06:00: edad mínima 18'
        ]);
    });

    it('skips closed days', () => {
        const lines = linesFor(fromTime('00:00'), BAR_21_03).join('\n');
        expect(lines).not.toMatch(/Lunes|Martes|Domingo/);
    });

    it('a day without information is covered at every hour, never read as free', () => {
        const hours = week({ sat: [{ open: '21:00', close: '03:00' }] });
        delete (hours.days as Record<string, unknown>).sun;
        expect(linesFor(fromTime('00:00'), hours)).toContain(
            '- Domingo, horario sin información, a toda hora: edad mínima 18'
        );
    });

    it('one malformed shift makes the day unreadable instead of dropping the shift', () => {
        const hours = week({
            fri: [{ open: '21:00', close: '23:00' }],
            sat: [
                { open: '12:00', close: '15:00' },
                { open: '25:00', close: '03:00' }
            ]
        });
        const lines = linesFor(fromTime('00:00'), hours);
        expect(lines).toContain('- Sábado, horario sin información, a toda hora: edad mínima 18');
        expect(lines.join('\n')).not.toMatch(/Sábado de 12:00/);
    });

    it.each([
        ['no opening hours', null],
        ['a legacy flat map', { sabado: '12:00-05:00' }],
        ['days that are not an object', { timezone: 'x', days: 'mon-fri' }],
        ['every day closed', week({})]
    ])('falls back to "every hour" for %s — never invents a free window', (_name, hours) => {
        const lines = linesFor(fromTime('00:00'), hours);
        expect(lines.slice(1)).toEqual([
            '- Todos los días, a toda hora y en todo el local: edad mínima 18 (los horarios cargados no permiten calcular otra cosa)'
        ]);
    });

    it('the timezone never moves a window: times are the venue wall clock', () => {
        const ba = linesFor(fromTime('00:00'), BAR_21_03);
        const madrid = linesFor(
            fromTime('00:00'),
            week(
                {
                    fri: [{ open: '21:00', close: '03:00' }],
                    sat: [{ open: '21:00', close: '03:00' }]
                },
                'Europe/Madrid'
            )
        );
        expect(madrid).toEqual(ba);
    });

    it('prints English and Portuguese wording', () => {
        expect(linesFor(fromTime('00:00'), BAR_21_03, 'en')).toContain(
            '- Saturday from 21:00 to 00:00 (midnight): no minimum age stated'
        );
        expect(linesFor(fromTime('00:00'), BAR_21_03, 'en')).toContain(
            '- Saturday, after midnight, from 00:00 to 03:00: minimum age 18'
        );
        expect(linesFor(fromTime('00:00'), BAR_21_03, 'pt')).toContain(
            '- Sábado das 21:00 às 00:00 (meia-noite): sem idade mínima informada'
        );
        expect(linesFor(fromTime('00:00'), BAR_21_03, 'pt')).toContain(
            '- Sábado, depois da meia-noite, das 00:00 às 03:00: idade mínima 18'
        );
    });
});

describe('buildVenueAgeWindowLines — all day, unset and area', () => {
    it('all day says the age applies at every hour and in the whole venue, whatever the hours', () => {
        const lines = linesFor({ kind: 'all_day', from: null, area: null }, BAR_21_03);
        expect(lines.slice(1)).toEqual([
            '- Todos los días, a toda hora (mediodía, tarde y noche) y en todo el local: edad mínima 18'
        ]);
    });

    it('a from_time scope with an invalid time reads as all day', () => {
        const lines = linesFor(fromTime('24:00'), BAR_21_03);
        expect(lines.join('\n')).not.toContain(FREE_ES);
    });

    it('area: the fenced area is covered, the rest has no stated minimum age', () => {
        const lines = linesFor({ kind: 'area', from: null, area: 'la pista' }, BAR_21_03);
        expect(lines.slice(1)).toEqual([
            `- En ${OWNER_DATA_DELIMITER_START}la pista${OWNER_DATA_DELIMITER_END}, a toda hora: edad mínima 18`,
            `- En el resto del local y en otras actividades: ${FREE_ES}`
        ]);
    });

    it('never carries permission wording', () => {
        for (const scope of [
            fromTime('00:00'),
            { kind: 'all_day', from: null, area: null } as const,
            { kind: 'area', from: null, area: 'la pista' } as const
        ]) {
            const text = linesFor(scope, BAR_21_03).join('\n');
            expect(text).not.toMatch(
                /pued(e|en|és)\s+(ir|entrar|ingresar)|no hay problema|menores/i
            );
        }
    });
});
