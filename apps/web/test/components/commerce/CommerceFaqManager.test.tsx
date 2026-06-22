/**
 * @file CommerceFaqManager.test.tsx
 * @description Unit tests for the commerce owner FAQ manager island (SPEC-253 T-026).
 *
 * Tests:
 * 1. Renders the FAQ list from initialFaqs.
 * 2. Shows empty state when no FAQs exist.
 * 3. Clicking "Add" opens the add form.
 * 4. Submitting the add form calls POST and adds the FAQ to the list.
 * 5. Clicking Edit opens the edit form with pre-filled values.
 * 6. Submitting the edit form calls PATCH and updates the FAQ.
 * 7. Clicking Delete (confirmed) calls DELETE and removes the FAQ.
 * 8. Clicking ↑/↓ calls PUT /reorder and reorders FAQs in the list.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommerceFaq } from '../../../src/components/commerce/CommerceFaqManager.client';
import { CommerceFaqManager } from '../../../src/components/commerce/CommerceFaqManager.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/components/commerce/CommerceFaqManager.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({ t: (key: string, fallback?: string) => fallback ?? key })
}));

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        put: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

import { apiClient } from '../../../src/lib/api/client';

const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked(apiClient.patch);
const mockDelete = vi.mocked(apiClient.delete);
const mockPut = vi.mocked(apiClient.put);

const FAQ_1: CommerceFaq = {
    id: 'faq-1',
    question: '¿Cuándo abren?',
    answer: 'De lunes a viernes de 9 a 18.',
    category: null,
    displayOrder: 0
};

const FAQ_2: CommerceFaq = {
    id: 'faq-2',
    question: '¿Tienen estacionamiento?',
    answer: 'Sí, gratuito.',
    category: null,
    displayOrder: 1
};

function renderManager(initialFaqs: readonly CommerceFaq[] = []) {
    return render(
        <CommerceFaqManager
            vertical="gastronomy"
            listingId="listing-1"
            locale="es"
            initialFaqs={initialFaqs}
        />
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommerceFaqManager', () => {
    beforeEach(() => {
        mockPost.mockReset();
        mockPatch.mockReset();
        mockDelete.mockReset();
        mockPut.mockReset();
        // Default window.confirm to true for delete tests
        vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    it('renders FAQ questions from initialFaqs', () => {
        renderManager([FAQ_1, FAQ_2]);
        expect(screen.getByText('¿Cuándo abren?')).toBeInTheDocument();
        expect(screen.getByText('¿Tienen estacionamiento?')).toBeInTheDocument();
    });

    it('shows empty state when no FAQs exist', () => {
        renderManager([]);
        expect(
            screen.getByText('Todavía no hay preguntas. Agregá la primera.')
        ).toBeInTheDocument();
    });

    it('shows the add form when the add button is clicked', () => {
        renderManager([]);
        const addBtn = screen.getByRole('button', { name: 'Agregar pregunta' });
        fireEvent.click(addBtn);
        expect(screen.getByLabelText('Pregunta')).toBeInTheDocument();
        expect(screen.getByLabelText('Respuesta')).toBeInTheDocument();
    });

    it('calls POST and appends the FAQ on successful add', async () => {
        const newFaq: CommerceFaq = {
            id: 'faq-new',
            question: '¿Tienen delivery?',
            answer: 'Sí, con Rappi.',
            category: null,
            displayOrder: 2
        };
        mockPost.mockResolvedValueOnce({ ok: true, data: newFaq });

        renderManager([FAQ_1]);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));

        const qField = screen.getByLabelText('Pregunta');
        const aField = screen.getByLabelText('Respuesta');
        fireEvent.change(qField, { target: { value: '¿Tienen delivery?' } });
        fireEvent.change(aField, { target: { value: 'Sí, con Rappi.' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => {
            expect(mockPost).toHaveBeenCalledWith({
                path: '/api/v1/protected/gastronomies/listing-1/faqs',
                body: expect.objectContaining({ question: '¿Tienen delivery?' })
            });
        });

        await waitFor(() => {
            expect(screen.getByText('¿Tienen delivery?')).toBeInTheDocument();
        });
    });

    it('opens the edit form with pre-filled values when Edit is clicked', () => {
        renderManager([FAQ_1]);
        fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
        const questionField = screen.getByLabelText('Pregunta') as HTMLTextAreaElement;
        expect(questionField.value).toBe('¿Cuándo abren?');
    });

    it('calls PATCH and updates the FAQ on successful edit', async () => {
        const updated = { ...FAQ_1, question: '¿Cuándo abre el local?' };
        mockPatch.mockResolvedValueOnce({ ok: true, data: updated });

        renderManager([FAQ_1]);
        fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

        const qField = screen.getByLabelText('Pregunta') as HTMLTextAreaElement;
        fireEvent.change(qField, { target: { value: '¿Cuándo abre el local?' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => {
            expect(mockPatch).toHaveBeenCalledWith({
                path: '/api/v1/protected/gastronomies/listing-1/faqs/faq-1',
                body: expect.objectContaining({ question: '¿Cuándo abre el local?' })
            });
        });

        await waitFor(() => {
            expect(screen.getByText('¿Cuándo abre el local?')).toBeInTheDocument();
        });
    });

    it('calls DELETE and removes the FAQ when Delete is confirmed', async () => {
        mockDelete.mockResolvedValueOnce({ ok: true, data: { success: true } });

        renderManager([FAQ_1, FAQ_2]);
        // Click the first delete button (FAQ_1)
        const deleteButtons = screen.getAllByRole('button', { name: 'Eliminar' });
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(mockDelete).toHaveBeenCalledWith({
                path: '/api/v1/protected/gastronomies/listing-1/faqs/faq-1'
            });
        });

        await waitFor(() => {
            expect(screen.queryByText('¿Cuándo abren?')).not.toBeInTheDocument();
        });
    });

    it('does NOT call DELETE when confirm returns false', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        renderManager([FAQ_1]);
        const deleteBtn = screen.getByRole('button', { name: 'Eliminar' });
        fireEvent.click(deleteBtn);
        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('calls PUT /reorder when the down arrow is clicked', async () => {
        mockPut.mockResolvedValueOnce({ ok: true, data: { success: true } });

        renderManager([FAQ_1, FAQ_2]);
        // The "Bajar" button (aria-label) for FAQ_1 (first item, index 0)
        const bajarButtons = screen.getAllByRole('button', { name: 'Bajar' });
        fireEvent.click(bajarButtons[0]);

        await waitFor(() => {
            expect(mockPut).toHaveBeenCalledWith({
                path: '/api/v1/protected/gastronomies/listing-1/faqs/reorder',
                body: expect.objectContaining({ order: expect.any(Array) })
            });
        });
    });

    it('hides the add form after cancel is clicked', () => {
        renderManager([]);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));
        expect(screen.getByLabelText('Pregunta')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.queryByLabelText('Pregunta')).not.toBeInTheDocument();
    });

    it('disables the up button for the first FAQ and down button for the last FAQ', () => {
        renderManager([FAQ_1, FAQ_2]);
        const subirButtons = screen.getAllByRole('button', { name: 'Subir' });
        const bajarButtons = screen.getAllByRole('button', { name: 'Bajar' });
        // First FAQ: "Subir" disabled
        expect(subirButtons[0]).toBeDisabled();
        // Last FAQ: "Bajar" disabled
        expect(bajarButtons[bajarButtons.length - 1]).toBeDisabled();
    });
});
