/**
 * @file FaqSection.test.tsx
 * @description Tests for the accommodation editor's FaqSection (HOS-393).
 *
 * Covers:
 * 1. Renders the FAQ list from initialFaqs.
 * 2. Shows the empty state when no FAQs exist.
 * 3. Clicking "Agregar pregunta" opens the add form.
 * 4. Submitting the add form calls accommodationFaqApi.add and appends the FAQ.
 * 5. Clicking Edit opens the edit form pre-filled, and Save calls .update (PUT).
 * 6. Clicking Delete (confirmed) calls .remove and removes the FAQ from the list.
 * 7. Clicking the down arrow calls .reorder and reorders the list.
 * 8. Per-row action buttons carry a UNIQUE accessible name (question-scoped) —
 *    regression guard for the duplicate-name bug already hit once in
 *    CommerceFaqManager (four action pairs sharing one name across rows).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccommodationFaqItem } from '@/components/host/editor/FaqSection.client';
import { FaqSection } from '@/components/host/editor/FaqSection.client';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockAdd, mockUpdate, mockRemove, mockReorder } = vi.hoisted(() => ({
    mockAdd: vi.fn(),
    mockUpdate: vi.fn(),
    mockRemove: vi.fn(),
    mockReorder: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/components/host/editor/FaqSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const raw = fallback ?? key;
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
                raw
            );
        },
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationFaqApi: {
        add: mockAdd,
        update: mockUpdate,
        remove: mockRemove,
        reorder: mockReorder
    }
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const FAQ_1: AccommodationFaqItem = {
    id: 'faq-1',
    question: '¿Cuándo es el check-in?',
    answer: 'A partir de las 14hs.',
    category: null,
    displayOrder: 0
};

const FAQ_2: AccommodationFaqItem = {
    id: 'faq-2',
    question: '¿Aceptan mascotas?',
    answer: 'Sí, previa consulta.',
    category: null,
    displayOrder: 1
};

function renderSection(initialFaqs: readonly AccommodationFaqItem[] = []) {
    return render(
        <FaqSection
            locale="es"
            accommodationId="acc-1"
            initialFaqs={initialFaqs}
        />
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FaqSection', () => {
    beforeEach(() => {
        mockAdd.mockReset();
        mockUpdate.mockReset();
        mockRemove.mockReset();
        mockReorder.mockReset();
        vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    it('renders FAQ questions from initialFaqs', () => {
        renderSection([FAQ_1, FAQ_2]);
        expect(screen.getByText('¿Cuándo es el check-in?')).toBeInTheDocument();
        expect(screen.getByText('¿Aceptan mascotas?')).toBeInTheDocument();
    });

    it('shows the empty state when no FAQs exist', () => {
        renderSection([]);
        expect(
            screen.getByText('Todavía no hay preguntas. Agregá la primera.')
        ).toBeInTheDocument();
    });

    it('shows the add form when the add button is clicked', () => {
        renderSection([]);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));
        expect(screen.getByLabelText('Pregunta')).toBeInTheDocument();
        expect(screen.getByLabelText('Respuesta')).toBeInTheDocument();
    });

    it('calls accommodationFaqApi.add and appends the FAQ on successful add', async () => {
        const newFaq: AccommodationFaqItem = {
            id: 'faq-new',
            question: '¿Hay wifi?',
            answer: 'Sí, gratuito en todo el hospedaje.',
            category: null,
            displayOrder: 2
        };
        mockAdd.mockResolvedValueOnce({ ok: true, data: { faq: newFaq } });

        renderSection([FAQ_1]);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));

        fireEvent.change(screen.getByLabelText('Pregunta'), {
            target: { value: '¿Hay wifi?' }
        });
        fireEvent.change(screen.getByLabelText('Respuesta'), {
            target: { value: 'Sí, gratuito en todo el hospedaje.' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => {
            expect(mockAdd).toHaveBeenCalledWith({
                accommodationId: 'acc-1',
                question: '¿Hay wifi?',
                answer: 'Sí, gratuito en todo el hospedaje.'
            });
        });

        await waitFor(() => {
            expect(screen.getByText('¿Hay wifi?')).toBeInTheDocument();
        });
    });

    it('opens the edit form pre-filled and calls .update (PUT) on save', async () => {
        const updated = { ...FAQ_1, question: '¿A qué hora es el check-in?' };
        mockUpdate.mockResolvedValueOnce({ ok: true, data: { faq: updated } });

        renderSection([FAQ_1]);
        fireEvent.click(screen.getByRole('button', { name: /^Editar/ }));

        const questionField = screen.getByLabelText('Pregunta') as HTMLTextAreaElement;
        expect(questionField.value).toBe('¿Cuándo es el check-in?');

        fireEvent.change(questionField, { target: { value: '¿A qué hora es el check-in?' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => {
            expect(mockUpdate).toHaveBeenCalledWith({
                accommodationId: 'acc-1',
                faqId: 'faq-1',
                question: '¿A qué hora es el check-in?',
                answer: 'A partir de las 14hs.'
            });
        });

        await waitFor(() => {
            expect(screen.getByText('¿A qué hora es el check-in?')).toBeInTheDocument();
        });
    });

    it('calls .remove and removes the FAQ when delete is confirmed', async () => {
        mockRemove.mockResolvedValueOnce({ ok: true, data: { success: true } });

        renderSection([FAQ_1, FAQ_2]);
        fireEvent.click(
            screen.getByRole('button', { name: /^Eliminar "¿Cuándo es el check-in\?"/ })
        );

        await waitFor(() => {
            expect(mockRemove).toHaveBeenCalledWith({ accommodationId: 'acc-1', faqId: 'faq-1' });
        });

        await waitFor(() => {
            expect(screen.queryByText('¿Cuándo es el check-in?')).not.toBeInTheDocument();
        });
    });

    it('does NOT call .remove when the confirm dialog is cancelled', () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        renderSection([FAQ_1]);
        fireEvent.click(screen.getByRole('button', { name: /^Eliminar "/ }));
        expect(mockRemove).not.toHaveBeenCalled();
    });

    it('calls .reorder when the down arrow is clicked', async () => {
        mockReorder.mockResolvedValueOnce({ ok: true, data: { success: true } });

        renderSection([FAQ_1, FAQ_2]);
        fireEvent.click(screen.getByRole('button', { name: /^Bajar "¿Cuándo es el check-in\?"/ }));

        await waitFor(() => {
            expect(mockReorder).toHaveBeenCalledWith({
                accommodationId: 'acc-1',
                order: [
                    { faqId: 'faq-2', displayOrder: 0 },
                    { faqId: 'faq-1', displayOrder: 1 }
                ]
            });
        });
    });

    it('rolls back the optimistic reorder when the API call fails', async () => {
        mockReorder.mockResolvedValueOnce({ ok: false, error: { status: 500, message: 'boom' } });

        renderSection([FAQ_1, FAQ_2]);
        fireEvent.click(screen.getByRole('button', { name: /^Bajar "¿Cuándo es el check-in\?"/ }));

        await waitFor(() => {
            expect(screen.getByText('No se pudo reordenar.')).toBeInTheDocument();
        });

        // FAQ_1 is still first in DOM order after rollback.
        const questions = screen.getAllByText(/¿/).map((el) => el.textContent);
        expect(questions[0]).toBe('¿Cuándo es el check-in?');
    });

    it('disables the up button for the first FAQ and the down button for the last', () => {
        renderSection([FAQ_1, FAQ_2]);
        expect(
            screen.getByRole('button', { name: /^Subir "¿Cuándo es el check-in\?"/ })
        ).toBeDisabled();
        expect(screen.getByRole('button', { name: /^Bajar "¿Aceptan mascotas\?"/ })).toBeDisabled();
    });

    it('gives each row unique accessible names for its action buttons (a11y regression)', () => {
        // Regression guard: CommerceFaqManager once shipped four action pairs
        // (Subir/Bajar/Editar/Eliminar) all sharing ONE accessible name across
        // every row. Every action button here must embed the row's own
        // question so no two rows collide.
        renderSection([FAQ_1, FAQ_2]);

        const editButtons = screen.getAllByRole('button', { name: /^Editar "/ });
        const deleteButtons = screen.getAllByRole('button', { name: /^Eliminar "/ });
        const editNames = editButtons.map((btn) => btn.getAttribute('aria-label'));
        const deleteNames = deleteButtons.map((btn) => btn.getAttribute('aria-label'));

        expect(new Set(editNames).size).toBe(editNames.length);
        expect(new Set(deleteNames).size).toBe(deleteNames.length);
    });

    it('hides the add form after cancel is clicked', () => {
        renderSection([]);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));
        expect(screen.getByLabelText('Pregunta')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.queryByLabelText('Pregunta')).not.toBeInTheDocument();
    });
});
