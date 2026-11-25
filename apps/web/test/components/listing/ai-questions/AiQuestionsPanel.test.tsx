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
    buildAiQuestionsParams,
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

    it('shows a translated label instead of the raw redaction markers (HOS-2320)', async () => {
        // Arrange
        mockGetProtected.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    item(
                        '22222222-2222-4222-8222-222222222222',
                        'Llamenme al [REDACTED_PHONE] o a [REDACTED_EMAIL]',
                        'unanswered'
                    )
                ],
                total: 1,
                unansweredCount: 1,
                truncated: false,
                dismissed: [],
                dismissedCount: 0,
                othersNextCursor: null
            }
        });

        // Act
        const { container } = renderPanel();

        // Assert
        expect(
            await screen.findByText('Llamenme al [teléfono oculto] o a [email oculto]')
        ).toBeInTheDocument();
        expect(container.innerHTML).not.toContain('REDACTED');
        const link = container.querySelector(`a[href^="${FAQ_URL}"]`);
        expect(link).not.toBeNull();
        expect(decodeURIComponent(link?.getAttribute('href') ?? '')).not.toContain('REDACTED');
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

        // HOS-2503: flat kit Sections, the overview first, then unanswered before the rest.
        const regions = screen.getAllByRole('region');
        expect(regions[0]).toHaveAccessibleName('Preguntas a la IA');
        expect(regions.indexOf(unanswered)).toBeLessThan(regions.indexOf(others));
        expect(regions.indexOf(unanswered)).toBe(1);
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
        // HOS-2503: the dismissed list is its own kit Section, collapsed in a <details>.
        const dismissedSection = await screen.findByRole('region', { name: /descartadas/i });
        const disclosure = dismissedSection.querySelector('details');
        expect(disclosure?.textContent).toContain('Ver las descartadas');
        expect(within(dismissedSection).getByText('¿Mascotas?')).toBeTruthy();
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

const EMPTY_RESPONSE = {
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
};

// Filters are only offered when there is data to filter, or one is active (HOS-2624).
const DATA_RESPONSE = {
    ok: true,
    data: {
        items: [item('d1', 'Con datos', 'answered')],
        total: 1,
        unansweredCount: 0,
        truncated: false,
        dismissed: [],
        dismissedCount: 0,
        othersNextCursor: null
    }
};

describe('AiQuestionsPanel date filter (HOS-2075)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('builds params without from/to when unset and with them when set', () => {
        expect(buildAiQuestionsParams({ entityType: 'venue', entityId: LISTING_ID })).toEqual({
            entityType: 'venue',
            entityId: LISTING_ID
        });
        expect(
            buildAiQuestionsParams({
                entityType: 'venue',
                entityId: LISTING_ID,
                from: '2026-10-01',
                to: '2026-10-31',
                othersCursor: 'c1'
            })
        ).toEqual({
            entityType: 'venue',
            entityId: LISTING_ID,
            from: '2026-10-01',
            to: '2026-10-31',
            othersCursor: 'c1'
        });
    });

    it('refetches from the first page with from/to when the range changes, and clears', async () => {
        mockGetProtected.mockResolvedValue(EMPTY_RESPONSE);
        mockGetProtected.mockResolvedValueOnce(DATA_RESPONSE);
        renderPanel();
        await waitFor(() => expect(mockGetProtected).toHaveBeenCalledTimes(1));
        await screen.findByText('Con datos');

        fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
        await waitFor(() => expect(mockGetProtected).toHaveBeenCalledTimes(2));
        fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-31' } });
        await waitFor(() => expect(mockGetProtected).toHaveBeenCalledTimes(3));

        const last = mockGetProtected.mock.calls[2]?.[0];
        expect(last.params).toEqual({
            entityType: 'venue',
            entityId: LISTING_ID,
            from: '2026-10-01',
            to: '2026-10-31'
        });
        expect(last.params.othersCursor).toBeUndefined();

        fireEvent.click(screen.getByRole('button', { name: 'Limpiar fechas' }));
        await waitFor(() => expect(mockGetProtected).toHaveBeenCalledTimes(4));
        expect(mockGetProtected.mock.calls[3]?.[0].params).toEqual({
            entityType: 'venue',
            entityId: LISTING_ID
        });
    });

    it('hides the date filters when there is nothing to filter yet', async () => {
        mockGetProtected.mockResolvedValue(EMPTY_RESPONSE);
        renderPanel();
        await screen.findByText('Todavía nadie le hizo preguntas al asistente de esta ficha.');

        expect(screen.queryByLabelText('Desde')).toBeNull();
    });

    it('shows a polite message on a 400 and keeps the filters usable', async () => {
        mockGetProtected.mockResolvedValueOnce(DATA_RESPONSE);
        renderPanel();
        await screen.findByLabelText('Desde');

        mockGetProtected.mockResolvedValueOnce({
            ok: false,
            error: { status: 400, code: 'VALIDATION_ERROR' }
        });
        fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2020-01-01' } });

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('El rango de fechas no es válido');
        expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    });

    it('tells the owner that contact data is hidden', async () => {
        mockGetProtected.mockResolvedValue(EMPTY_RESPONSE);
        renderPanel();
        expect(
            await screen.findByText(/datos de contacto \(emails y teléfonos\) se ocultan/i)
        ).toBeInTheDocument();
    });
});
