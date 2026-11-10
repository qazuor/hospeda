/**
 * «Preguntas a la IA» panel (HOS-2101): unanswered first with a counter and
 * the FAQ shortcut, the rest below, and the empty / error states.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetProtected } = vi.hoisted(() => ({ mockGetProtected: vi.fn() }));

vi.mock('../../../../src/lib/api/client', () => ({
    apiClient: { getProtected: mockGetProtected }
}));

vi.mock('../../../../src/components/listing/ai-questions/AiQuestionsPanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_target, prop) => String(prop) })
}));

import {
    AI_LISTING_QUESTIONS_PATH,
    AiQuestionsPanel,
    splitAiQuestions
} from '../../../../src/components/listing/ai-questions/AiQuestionsPanel.client';

const LISTING_ID = '11111111-1111-4111-8111-111111111111';
const FAQ_URL = `/es/mi-cuenta/comercio/venue/${LISTING_ID}/editar/preguntas/`;

const item = (
    id: string,
    question: string,
    answerStatus: 'answered' | 'unanswered' | 'unclassified'
) => ({
    id,
    question,
    answer: `Respuesta a ${question}`,
    askedAt: '2026-11-09T12:00:00.000Z',
    answerStatus
});

function renderPanel() {
    return render(
        <AiQuestionsPanel
            locale="es"
            entityType="venue"
            entityId={LISTING_ID}
            faqUrl={FAQ_URL}
        />
    );
}

describe('AiQuestionsPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('asks the API for this listing', async () => {
        mockGetProtected.mockResolvedValue({
            ok: true,
            data: { items: [], total: 0, unansweredCount: 0, truncated: false }
        });

        renderPanel();

        await waitFor(() => expect(mockGetProtected).toHaveBeenCalledTimes(1));
        expect(mockGetProtected).toHaveBeenCalledWith({
            path: AI_LISTING_QUESTIONS_PATH,
            params: { entityType: 'venue', entityId: LISTING_ID }
        });
    });

    it('shows unanswered questions first, with the counter and the FAQ shortcut', async () => {
        // Arrange
        mockGetProtected.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    item('a', '¿Hay wifi?', 'answered'),
                    item('b', '¿Aceptan mascotas?', 'unanswered'),
                    item('c', '¿Tiene cochera?', 'unclassified')
                ],
                total: 3,
                unansweredCount: 1,
                truncated: false
            }
        });

        // Act
        renderPanel();

        // Assert
        const unanswered = await screen.findByRole('region', { name: /sin responder/i });
        expect(within(unanswered).getByText('1')).toBeTruthy();
        expect(within(unanswered).getByText('¿Aceptan mascotas?')).toBeTruthy();
        const link = within(unanswered).getByRole('link', {
            name: 'Agregar como pregunta frecuente'
        });
        expect(link.getAttribute('href')).toBe(
            `${FAQ_URL}?pregunta=${encodeURIComponent('¿Aceptan mascotas?')}`
        );

        const others = screen.getByRole('region', { name: /otras preguntas/i });
        expect(within(others).getByText('¿Hay wifi?')).toBeTruthy();
        expect(within(others).getByText('¿Tiene cochera?')).toBeTruthy();
        expect(within(others).queryByRole('link')).toBeNull();

        const regions = screen.getAllByRole('region');
        expect(regions[0]).toBe(unanswered);
    });

    it('says so when nobody asked anything', async () => {
        mockGetProtected.mockResolvedValue({
            ok: true,
            data: { items: [], total: 0, unansweredCount: 0, truncated: false }
        });

        renderPanel();

        expect(await screen.findByText(/todav.a nadie le hizo preguntas/i)).toBeTruthy();
    });

    it('shows an error when the request fails', async () => {
        mockGetProtected.mockResolvedValue({ ok: false, error: { status: 404 } });

        renderPanel();

        expect(await screen.findByRole('alert')).toBeTruthy();
    });

    it('notes when the list is truncated', async () => {
        mockGetProtected.mockResolvedValue({
            ok: true,
            data: {
                items: [item('a', 'Q', 'answered')],
                total: 250,
                unansweredCount: 0,
                truncated: true
            }
        });

        renderPanel();

        expect(await screen.findByText(/preguntas mostradas/i)).toBeTruthy();
    });
});

describe('splitAiQuestions', () => {
    it('keeps order inside each block', () => {
        const { unanswered, others } = splitAiQuestions({
            items: [
                item('1', 'a', 'unanswered'),
                item('2', 'b', 'answered'),
                item('3', 'c', 'unanswered')
            ]
        });

        expect(unanswered.map((entry) => entry.id)).toEqual(['1', '3']);
        expect(others.map((entry) => entry.id)).toEqual(['2']);
    });
});
