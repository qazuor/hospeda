/**
 * AiQuestionsWeeklyDigest email template (HOS-2101).
 *
 * Pins the three owner decisions the template carries: es/en/pt copy, a link
 * per listing to its «Preguntas a la IA» tab, and an opt-out link.
 *
 * @module test/templates/ai-questions-weekly-digest.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    AiQuestionsWeeklyDigest,
    type AiQuestionsWeeklyDigestProps,
    buildAiQuestionsDigestSubject
} from '../../src/templates/ai/ai-questions-weekly-digest';

const props: AiQuestionsWeeklyDigestProps = {
    recipientName: 'Ana',
    locale: 'es',
    preferencesUrl: 'https://hospeda.test/es/mi-cuenta/preferencias/',
    listings: [
        {
            listingName: 'Cabaña del Río',
            unansweredCount: 7,
            questions: ['¿Aceptan mascotas?', '¿Hay cochera?'],
            panelUrl: 'https://hospeda.test/es/mi-cuenta/propiedades/1/editar/preguntas-ia/'
        },
        {
            listingName: 'Parrilla Don José',
            unansweredCount: 1,
            questions: ['¿Tienen opciones sin TACC?'],
            panelUrl: 'https://hospeda.test/es/mi-cuenta/comercio/venue/2/editar/preguntas-ia/'
        }
    ]
};

describe('AiQuestionsWeeklyDigest', () => {
    it('renders every listing with its questions and its panel link', () => {
        // Arrange / Act
        const html = renderToStaticMarkup(AiQuestionsWeeklyDigest(props));

        // Assert
        expect(html).toContain('Cabaña del Río');
        expect(html).toContain('¿Aceptan mascotas?');
        expect(html).toContain('Parrilla Don José');
        expect(html).toContain(props.listings[0]?.panelUrl);
        expect(html).toContain(props.listings[1]?.panelUrl);
    });

    it('tells how many questions were left out of the excerpt', () => {
        const html = renderToStaticMarkup(AiQuestionsWeeklyDigest(props));

        expect(html).toContain('7 preguntas sin responder');
        expect(html).toContain('y 5 más');
        expect(html).toContain('1 pregunta sin responder');
    });

    it('carries the opt-out link', () => {
        const html = renderToStaticMarkup(AiQuestionsWeeklyDigest(props));

        expect(html).toContain('href="https://hospeda.test/es/mi-cuenta/preferencias/"');
    });

    it.each([
        ['en', 'unanswered questions', 'Turn it off in your preferences'],
        ['pt', 'perguntas sem resposta', 'Desative nas suas preferências']
    ] as const)('writes the %s copy', (locale, countText, optOut) => {
        const html = renderToStaticMarkup(AiQuestionsWeeklyDigest({ ...props, locale }));

        expect(html).toContain(countText);
        expect(html).toContain(optOut);
        expect(html).not.toContain('sin responder');
    });
});

describe('buildAiQuestionsDigestSubject', () => {
    it.each([
        ['es', 3, 'Tu chat de IA no pudo responder 3 preguntas esta semana'],
        ['es', 1, 'Tu chat de IA no pudo responder 1 pregunta esta semana'],
        ['en', 2, 'Your AI chat could not answer 2 questions this week'],
        ['pt', 4, 'Seu chat de IA não conseguiu responder 4 perguntas nesta semana']
    ] as const)('builds the %s subject for %i', (locale, totalUnanswered, expected) => {
        expect(buildAiQuestionsDigestSubject({ locale, totalUnanswered }).subject).toBe(expected);
    });
});
