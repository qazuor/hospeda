import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getProtected } = vi.hoisted(() => ({ getProtected: vi.fn() }));

vi.mock('../../../src/components/listing/ai-questions/AiQuestionsPanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) })
}));
vi.mock('../../../src/lib/i18n', async () => {
    const { tFromCatalog } = await import('../../helpers/i18n-catalog');
    return { createTranslations: () => ({ t: tFromCatalog }) };
});
vi.mock('../../../src/lib/api/client', () => ({
    apiClient: { getProtected, postProtected: vi.fn() }
}));

import { AiQuestionsPanel } from '../../../src/components/listing/ai-questions/AiQuestionsPanel.client';

const question = {
    id: '22222222-2222-4222-8222-222222222222',
    question: '¿Aceptan mascotas?',
    answer: 'Sí.',
    askedAt: '2026-11-09T12:00:00.000Z',
    answerStatus: 'answered' as const
};

function response(overrides: Record<string, unknown> = {}) {
    return {
        items: [question],
        total: 2,
        unansweredCount: 0,
        truncated: true,
        othersNextCursor: 'next',
        dismissed: [],
        dismissedCount: 0,
        ...overrides
    };
}

describe('AiQuestionsPanel paging notices', () => {
    beforeEach(() => vi.clearAllMocks());

    it('hides the first-page truncation notice after loading more', async () => {
        getProtected.mockResolvedValueOnce({ ok: true, data: response() }).mockResolvedValueOnce({
            ok: true,
            data: response({
                items: [{ ...question, id: '33333333-3333-4333-8333-333333333333' }],
                othersNextCursor: null
            })
        });
        render(
            <AiQuestionsPanel
                locale="es"
                entityType="accommodation"
                entityId="listing"
                faqUrl=""
            />
        );

        expect(await screen.findByText(/Preguntas mostradas: 1 de 2/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));

        await waitFor(() =>
            expect(screen.queryByText(/Preguntas mostradas:/)).not.toBeInTheDocument()
        );
    });

    it('explains that only the latest 50 dismissed questions are listed', async () => {
        getProtected.mockResolvedValue({
            ok: true,
            data: response({
                truncated: false,
                othersNextCursor: null,
                dismissedCount: 52,
                dismissed: Array.from({ length: 50 }, (_, index) => ({
                    ...question,
                    id: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`,
                    ownerDismissedAt: '2026-11-09T12:00:00.000Z'
                }))
            })
        });
        render(
            <AiQuestionsPanel
                locale="es"
                entityType="accommodation"
                entityId="listing"
                faqUrl=""
            />
        );

        expect(
            await screen.findByText(/Mostramos las últimas 50 de 52 preguntas descartadas/)
        ).toBeInTheDocument();
    });
});
