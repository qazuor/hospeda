/**
 * Read-time redaction in the owner panel mapping (HOS-2075, Q-2).
 */
import { describe, expect, it } from 'vitest';
import { toListingQuestionsResponse } from '../../src/services/ai-listing-questions.service.js';

const ROW = {
    id: '22222222-2222-4222-8222-222222222222',
    question: 'Mi mail es juan@mail.com y mi cel +54 9 3442 123456, ¿hay lugar?',
    answer: 'Anoté tu contacto juan@mail.com. Llamá al +54 9 3442 123456.',
    askedAt: new Date('2026-11-09T12:00:00.000Z'),
    answerStatus: 'unanswered',
    blockTotal: 1
};

describe('toListingQuestionsResponse redaction', () => {
    it('redacts personal data in the question and leaves the bot answer intact', () => {
        const response = toListingQuestionsResponse({ unansweredRows: [ROW], otherRows: [] });

        const item = response.items[0];
        expect(item?.question).toBe(
            'Mi mail es [REDACTED_EMAIL] y mi cel [REDACTED_PHONE], ¿hay lugar?'
        );
        expect(item?.answer).toBe('Anoté tu contacto juan@mail.com. Llamá al +54 9 3442 123456.');
    });

    it('leaves text without personal data untouched', () => {
        const clean = { ...ROW, question: '¿Aceptan mascotas?', answer: 'No consta en la ficha.' };
        const response = toListingQuestionsResponse({ unansweredRows: [], otherRows: [clean] });
        expect(response.items[0]?.question).toBe('¿Aceptan mascotas?');
        expect(response.items[0]?.answer).toBe('No consta en la ficha.');
    });
});
