/**
 * «Preguntas a la IA» on the kit (HOS-2503): every Section anchored to the
 * vertical's help article, the CountPill name, the Skeleton and ErrorState
 * retry, and the date inputs staying mounted across states.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetProtected } = vi.hoisted(() => ({ mockGetProtected: vi.fn() }));

vi.mock('../../../../src/lib/api/client', () => ({
    apiClient: { getProtected: mockGetProtected, postProtected: vi.fn() }
}));

import { AiQuestionsPanel } from '../../../../src/components/listing/ai-questions/AiQuestionsPanel.client';

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

describe('AiQuestionsPanel on the kit (HOS-2503)', () => {
    const ready = {
        ok: true,
        data: {
            items: [
                item('u1', '¿Aceptan mascotas?', 'unanswered'),
                item('a1', '¿Hay wifi?', 'answered')
            ],
            total: 2,
            unansweredCount: 1,
            truncated: false,
            dismissed: [],
            dismissedCount: 0,
            othersNextCursor: null
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        ['venue', 'section:venue.preguntas-ia'],
        ['accommodation', 'section:accommodation.preguntas-ia']
    ] as const)('anchors every section of a %s listing to its help article', async (entityType, anchor) => {
        // Arrange
        mockGetProtected.mockResolvedValue(ready);

        // Act
        const { container } = render(
            <AiQuestionsPanel
                locale="es"
                entityType={entityType}
                entityId={LISTING_ID}
                faqUrl={FAQ_URL}
            />
        );
        await screen.findByText('¿Hay wifi?');

        // Assert
        const sections = [...container.querySelectorAll('[data-kit-section]')];
        expect(sections).toHaveLength(3);
        for (const section of sections) {
            expect(section.getAttribute('data-help')).toBe(anchor);
        }
    });

    it('names the unanswered counter with the full count', async () => {
        // Arrange
        mockGetProtected.mockResolvedValue(ready);

        // Act
        renderPanel();

        // Assert
        expect(await screen.findByRole('img', { name: '1 sin responder' })).toHaveTextContent('1');
    });

    it('shows a busy skeleton while the first page loads', () => {
        // Arrange
        mockGetProtected.mockReturnValue(new Promise(() => {}));

        // Act
        const { container } = renderPanel();

        // Assert
        expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    });

    it('retries the first page from the kit error state', async () => {
        // Arrange
        mockGetProtected
            .mockResolvedValueOnce({ ok: false, error: { status: 500 } })
            .mockResolvedValueOnce(ready);

        // Act
        renderPanel();
        const alert = await screen.findByRole('alert');
        fireEvent.click(within(alert).getByRole('button'));

        // Assert
        expect(await screen.findByText('¿Hay wifi?')).toBeTruthy();
        expect(mockGetProtected).toHaveBeenCalledTimes(2);
    });

    it('keeps the same date input mounted when a range empties the list', async () => {
        // Arrange — the first page has questions, the filtered one is empty.
        mockGetProtected.mockResolvedValueOnce(ready).mockResolvedValueOnce({
            ok: true,
            data: { ...ready.data, items: [], total: 0, unansweredCount: 0 }
        });
        renderPanel();
        await screen.findByText('¿Hay wifi?');
        const input = screen.getByLabelText('Desde');

        // Act
        fireEvent.change(input, { target: { value: '2026-10-01' } });
        await screen.findByText('No hay preguntas en ese rango de fechas.');

        // Assert
        expect(screen.getByLabelText('Desde')).toBe(input);
    });
});
