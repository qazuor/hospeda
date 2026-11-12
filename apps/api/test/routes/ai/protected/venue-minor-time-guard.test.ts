import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
    asksAboutMinorWithoutTime,
    guardVenueMinorAnswer
} from '../../../../src/routes/ai/protected/venue-minor-time-guard.js';

describe('venue minor time guard', () => {
    const fixtures = JSON.parse(
        readFileSync(
            path.resolve(
                path.dirname(fileURLToPath(import.meta.url)),
                '../../../../../../packages/ai-core/scripts/ai-sweep/fixtures.json'
            ),
            'utf8'
        )
    ) as { cases: readonly { id: string; question: string }[] };
    const fixtureExpectations: Readonly<Record<string, boolean>> = {
        'venue-nightclub-minor': true,
        'venue-mixed-lunch-with-child': false,
        'venue-from-time-after-midnight': false,
        'venue-mixed-free-text-no-scope': false,
        'venue-area-scope-same-area': false,
        'venue-from-time-ambiguous-question': true,
        'venue-area-scope-injection': true,
        'venue-scope-00-saturday-22': false,
        'venue-scope-00-saturday-2130-leave-23': false,
        'venue-scope-2330-saturday-22-leave-23': false,
        'venue-scope-00-one-am': false,
        'venue-scope-2330-one-am': false,
        'venue-scope-00-ambiguous-minors': true,
        'venue-scope-2330-ambiguous-minors': true,
        'venue-scope-all-day-saturday-22': false,
        'venue-area-scope-other-area': false
    };
    it.each(Object.entries(fixtureExpectations))('classifies sweep case %s', (id, expected) => {
        const question = fixtures.cases.find((candidate) => candidate.id === id)?.question;
        expect(question).toBeDefined();
        expect(asksAboutMinorWithoutTime(question ?? '')).toBe(expected);
    });

    it.each([
        ['¿puedo ir con mi hijo?', true],
        ['¿puedo ir con mi hijo de 15 años?', true],
        ['¿puedo ir con mi hijo de 15 el sábado?', true],
        ['¿puedo ir con mi hijo el sábado?', true],
        ['¿puedo ir con mi hijo a las 22?', false],
        ['¿puedo ir con mi hijo al almuerzo?', false],
        ['¿puedo ir a almorzar con mi hijo?', false],
        ['¿con mi hijo de 16 a la 1?', false],
        ['tengo 2 hijos, ¿pueden entrar?', true],
        ['Can my child come for dinner?', false],
        ['Meu filho pode entrar à noite?', false],
        ['Can my kid attend?', true],
        ['¿Puedo ir con mi pareja?', false]
    ])('classifies %s', (question, expected) => {
        expect(asksAboutMinorWithoutTime(question)).toBe(expected);
    });

    it('replaces an affirmative opening and preserves the remaining stream text', async () => {
        const onTrip = vi.fn();
        const chunks = (async function* () {
            yield 'Sí, pueden venir. ';
            yield 'Confirmá con el lugar.';
        })();
        const result: string[] = [];
        for await (const chunk of guardVenueMinorAnswer({
            chunks,
            guarded: true,
            locale: 'es',
            onTrip
        }))
            result.push(chunk);
        expect(result.join('')).toBe('Depende del horario: pueden venir. Confirmá con el lugar.');
        expect(onTrip).toHaveBeenCalledOnce();
    });

    it('passes through a non-affirmative answer', async () => {
        const onTrip = vi.fn();
        const chunks = (async function* () {
            yield 'La ficha no informa la edad mínima.';
        })();
        const result: string[] = [];
        for await (const chunk of guardVenueMinorAnswer({
            chunks,
            guarded: true,
            locale: 'es',
            onTrip
        }))
            result.push(chunk);
        expect(result.join('')).toBe('La ficha no informa la edad mínima.');
        expect(onTrip).not.toHaveBeenCalled();
    });

    it('passes through a conditional “Si es viernes o sábado, no:” unchanged', async () => {
        const onTrip = vi.fn();
        const answer = 'Si es viernes o sábado, no: el horario depende del lugar.';
        const chunks = (async function* () {
            yield answer;
        })();
        const result: string[] = [];
        for await (const chunk of guardVenueMinorAnswer({
            chunks,
            guarded: true,
            locale: 'es',
            onTrip
        }))
            result.push(chunk);
        expect(result.join('')).toBe(answer);
        expect(onTrip).not.toHaveBeenCalled();
    });

    it('replaces an affirmation split across chunks', async () => {
        const onTrip = vi.fn();
        const chunks = (async function* () {
            yield 'S';
            yield 'í: el sábado pueden venir.';
        })();
        const result: string[] = [];
        for await (const chunk of guardVenueMinorAnswer({
            chunks,
            guarded: true,
            locale: 'es',
            onTrip
        }))
            result.push(chunk);
        expect(result.join('')).toBe('Depende del horario: el sábado pueden venir.');
        expect(onTrip).toHaveBeenCalledOnce();
    });

    it('replaces a short affirmative answer without punctuation', async () => {
        const onTrip = vi.fn();
        const chunks = (async function* () {
            yield 'Sí';
        })();
        const result: string[] = [];
        for await (const chunk of guardVenueMinorAnswer({
            chunks,
            guarded: true,
            locale: 'es',
            onTrip
        }))
            result.push(chunk);
        expect(result.join('')).toBe('Depende del horario:');
        expect(onTrip).toHaveBeenCalledOnce();
    });

    it('emits nothing for an empty stream', async () => {
        const onTrip = vi.fn();
        const chunks = (async function* () {})();
        const result: string[] = [];
        for await (const chunk of guardVenueMinorAnswer({
            chunks,
            guarded: true,
            locale: 'es',
            onTrip
        }))
            result.push(chunk);
        expect(result).toEqual([]);
        expect(onTrip).not.toHaveBeenCalled();
    });
});
