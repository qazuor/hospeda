/**
 * «Preguntas a la IA» panel (HOS-2101): unanswered first with a counter and
 * the FAQ shortcut, the rest below, and the empty / error states.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetProtected, mockPostProtected } = vi.hoisted(() => ({
    mockGetProtected: vi.fn(),
    mockPostProtected: vi.fn()
}));

vi.mock('../../../../src/lib/api/client', () => ({
    apiClient: { getProtected: mockGetProtected, postProtected: mockPostProtected }
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

function renderPanel(faqUrl: string = FAQ_URL) {
    return render(
        <AiQuestionsPanel
            locale="es"
            entityType="venue"
            entityId={LISTING_ID}
            faqUrl={faqUrl}
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
            data: {
                items: [],
                total: 0,
                unansweredCount: 0,
                truncated: false,
                dismissed: [],
                dismissedCount: 0,
                othersNextCursor: null
            }
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
                    { ...item('a', '¿Hay wifi?', 'answered'), answer: '**Hay wifi**' },
                    item(
                        '22222222-2222-4222-8222-222222222222',
                        '¿Aceptan mascotas?',
                        'unanswered'
                    ),
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
        const linkUrl = new URL(link.getAttribute('href') ?? '', 'https://example.test');
        expect(linkUrl.searchParams.get('pregunta')).toBe('¿Aceptan mascotas?');
        expect(linkUrl.searchParams.get('mensaje')).toBe('22222222-2222-4222-8222-222222222222');
        expect(linkUrl.searchParams.has('respuesta')).toBe(false);

        const others = screen.getByRole('region', { name: /otras preguntas/i });
        expect(within(others).getByText('¿Hay wifi?')).toBeTruthy();
        expect(within(others).getByText('¿Tiene cochera?')).toBeTruthy();
        const answeredFaqLink = within(others).getAllByRole('link', {
            name: 'Agregar como pregunta frecuente'
        })[0];
        expect(answeredFaqLink).toBeDefined();
        const answeredFaqUrl = new URL(
            answeredFaqLink.getAttribute('href') ?? '',
            'https://example.test'
        );
        expect(answeredFaqUrl.searchParams.get('respuesta')).toBe('Hay wifi');

        const regions = screen.getAllByRole('region');
        expect(regions[0]).toBe(unanswered);
    });

    it('renders the assistant answer markdown instead of showing the raw markers', async () => {
        // Arrange — regression: the owner saw literal **bold** markers in staging.
        mockGetProtected.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    {
                        ...item('a', '¿Hay estacionamiento?', 'unanswered'),
                        answer: 'En la ficha de **Bar Smoke** no figura si hay estacionamiento.'
                    }
                ],
                dismissed: [],
                dismissedCount: 0,
                othersNextCursor: null,
                total: 1,
                unansweredCount: 1,
                truncated: false
            }
        });

        // Act
        renderPanel();

        // Assert
        const bold = await screen.findByText('Bar Smoke');
        expect(bold.tagName).toBe('STRONG');
        expect(screen.queryByText(/\*\*/)).toBeNull();
    });

    it('says so when nobody asked anything', async () => {
        mockGetProtected.mockResolvedValue({
            ok: true,
            data: {
                items: [],
                total: 0,
                unansweredCount: 0,
                truncated: false,
                dismissed: [],
                dismissedCount: 0,
                othersNextCursor: null
            }
        });

        renderPanel();

        expect(await screen.findByText(/todav.a nadie le hizo preguntas/i)).toBeTruthy();
    });

    it('shows an error when the request fails', async () => {
        mockGetProtected.mockResolvedValue({ ok: false, error: { status: 500 } });

        renderPanel();

        expect(await screen.findByRole('alert')).toBeTruthy();
    });

    it('shows a neutral note, not an error, when the viewer does not own the listing', async () => {
        mockGetProtected.mockResolvedValue({ ok: false, error: { status: 404 } });

        renderPanel();

        expect(await screen.findByText(/solo el due.o de la ficha/i)).toBeTruthy();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('hides the FAQ shortcut when the vertical has no FAQ section', async () => {
        mockGetProtected.mockResolvedValue({
            ok: true,
            data: {
                items: [item('b', '¿Aceptan mascotas?', 'unanswered')],
                total: 1,
                unansweredCount: 1,
                truncated: false
            }
        });

        renderPanel('');

        expect(await screen.findByText('¿Aceptan mascotas?')).toBeTruthy();
        expect(screen.queryByRole('link')).toBeNull();
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

    it('dismisses an unanswered question and refreshes it into the dismissed section', async () => {
        mockPostProtected.mockResolvedValue({ ok: true, data: {} });
        mockGetProtected
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    items: [
                        item('22222222-2222-4222-8222-222222222222', '¿Mascotas?', 'unanswered')
                    ],
                    total: 1,
                    unansweredCount: 1,
                    truncated: false,
                    dismissed: [],
                    dismissedCount: 0,
                    othersNextCursor: null
                }
            })
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    items: [],
                    total: 0,
                    unansweredCount: 0,
                    truncated: false,
                    dismissed: [
                        {
                            ...item(
                                '22222222-2222-4222-8222-222222222222',
                                '¿Mascotas?',
                                'unanswered'
                            ),
                            ownerDismissedAt: '2026-11-10T12:00:00.000Z'
                        }
                    ],
                    dismissedCount: 1,
                    othersNextCursor: null
                }
            });
        renderPanel();
        await screen.findByText('¿Mascotas?');
        fireEvent.click(screen.getByRole('button', { name: 'Ya lo vi' }));
        await waitFor(() =>
            expect(document.querySelector('details')?.textContent).toContain('Descartadas')
        );
        expect(screen.getByText('¿Mascotas?')).toBeTruthy();
        expect(mockPostProtected).toHaveBeenCalledWith({
            path: `${AI_LISTING_QUESTIONS_PATH}/22222222-2222-4222-8222-222222222222/dismiss`
        });
    });

    it('loads the next page of other questions and hides the paging button when exhausted', async () => {
        mockGetProtected
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    items: [item('a', 'Primera', 'answered')],
                    total: 2,
                    unansweredCount: 0,
                    truncated: true,
                    dismissed: [],
                    dismissedCount: 0,
                    othersNextCursor: 'cursor'
                }
            })
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    items: [item('b', 'Siguiente', 'answered')],
                    total: 2,
                    unansweredCount: 0,
                    truncated: false,
                    dismissed: [],
                    dismissedCount: 0,
                    othersNextCursor: null
                }
            });
        renderPanel();
        await screen.findByText('Primera');
        screen.getByRole('button', { name: 'Ver más' }).click();
        expect(await screen.findByText('Siguiente')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
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
