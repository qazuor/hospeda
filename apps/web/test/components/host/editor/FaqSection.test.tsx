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
 * 6. Clicking Delete opens the shared ConfirmDeleteDialog; confirming calls .remove and
 *    removes the FAQ from the list; cancelling closes it without deleting
 *    (HOS-794 — no more native `window.confirm`).
 * 7. Clicking the down arrow calls .reorder and reorders the list.
 * 8. Per-row action buttons carry a UNIQUE accessible name (question-scoped) —
 *    regression guard for the duplicate-name bug already hit once in
 *    CommerceFaqManager (four action pairs sharing one name across rows).
 * 9. Channel-visibility checkboxes (HOS-393 fase 2): both default to checked
 *    on a new FAQ (G-3), toggling them is reflected in the .add/.update
 *    payload, and the edit form seeds them from the FAQ's current flags.
 * 10. Per-row non-default marker (AC-14): a FAQ with either flag off shows a
 *     text-visible badge (not colour-only); a FAQ at the all-true default
 *     shows neither badge.
 * 11. Submitting an invalid form marks the fields instead of returning
 *     silently: empty fields get the required message, short fields get the
 *     schema's min message, the shared "Revisá los campos marcados" toast
 *     fires, and typing clears the per-field error (HOS-794 AC-1/AC-2).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccommodationFaqItem } from '@/components/host/editor/FaqSection.client';
import { FaqSection } from '@/components/host/editor/FaqSection.client';
import { addToast } from '@/store/toast-store';

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

vi.mock('@/components/shared/ui/ConfirmDeleteDialog.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/shared/ui/Dialog.client', () => ({
    Dialog: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
        isOpen ? <div role="presentation">{children}</div> : null,
    DialogHeader: ({ children, titleId }: { children: React.ReactNode; titleId: string }) => (
        <div id={titleId}>{children}</div>
    ),
    DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
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
    displayOrder: 0,
    isVisibleOnListing: true,
    isUsableByAi: true
};

const FAQ_2: AccommodationFaqItem = {
    id: 'faq-2',
    question: '¿Aceptan mascotas?',
    answer: 'Sí, previa consulta.',
    category: null,
    displayOrder: 1,
    isVisibleOnListing: true,
    isUsableByAi: true
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
        vi.mocked(addToast).mockClear();
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
            displayOrder: 2,
            isVisibleOnListing: true,
            isUsableByAi: true
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
                answer: 'Sí, gratuito en todo el hospedaje.',
                isVisibleOnListing: true,
                isUsableByAi: true
            });
        });

        await waitFor(() => {
            expect(screen.getByText('¿Hay wifi?')).toBeInTheDocument();
        });
    });

    it('defaults both channel-visibility checkboxes to checked on a new FAQ (G-3)', () => {
        renderSection([]);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));

        const visibleCheckbox = screen.getByLabelText(
            'Visible en la ficha pública'
        ) as HTMLInputElement;
        const aiCheckbox = screen.getByLabelText('Usable por la IA') as HTMLInputElement;

        expect(visibleCheckbox.checked).toBe(true);
        expect(aiCheckbox.checked).toBe(true);
    });

    it('sends unchecked channel-visibility flags in the .add payload', async () => {
        const newFaq: AccommodationFaqItem = {
            id: 'faq-new',
            question: '¿Hay estacionamiento cubierto?',
            answer: 'Sí, para dos vehículos.',
            category: null,
            displayOrder: 2,
            isVisibleOnListing: false,
            isUsableByAi: false
        };
        mockAdd.mockResolvedValueOnce({ ok: true, data: { faq: newFaq } });

        renderSection([]);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));

        fireEvent.change(screen.getByLabelText('Pregunta'), {
            target: { value: '¿Hay estacionamiento cubierto?' }
        });
        fireEvent.change(screen.getByLabelText('Respuesta'), {
            target: { value: 'Sí, para dos vehículos.' }
        });
        fireEvent.click(screen.getByLabelText('Visible en la ficha pública'));
        fireEvent.click(screen.getByLabelText('Usable por la IA'));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => {
            expect(mockAdd).toHaveBeenCalledWith({
                accommodationId: 'acc-1',
                question: '¿Hay estacionamiento cubierto?',
                answer: 'Sí, para dos vehículos.',
                isVisibleOnListing: false,
                isUsableByAi: false
            });
        });
    });

    it('marks both add-form fields, toasts and focuses when saving with empty values', () => {
        renderSection([]);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        // No silent return: the fields are marked, nothing is sent (HOS-794).
        expect(mockAdd).not.toHaveBeenCalled();
        expect(screen.getByText('La pregunta es obligatoria')).toBeInTheDocument();
        expect(screen.getByText('La respuesta es obligatoria')).toBeInTheDocument();
        expect(screen.getByLabelText('Pregunta')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Pregunta')).toHaveFocus();
        expect(vi.mocked(addToast)).toHaveBeenCalledWith({
            type: 'error',
            message: 'Revisá los campos marcados'
        });
    });

    it('marks only the empty field when the other one is filled', () => {
        renderSection([]);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));

        fireEvent.change(screen.getByLabelText('Pregunta'), {
            target: { value: '¿Hay wifi en las habitaciones?' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        expect(mockAdd).not.toHaveBeenCalled();
        expect(screen.queryByText('La pregunta es obligatoria')).not.toBeInTheDocument();
        expect(screen.getByText('La respuesta es obligatoria')).toBeInTheDocument();
    });

    it('surfaces the schema minimum instead of failing silently (HOS-794 AC-2)', () => {
        renderSection([]);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));

        fireEvent.change(screen.getByLabelText('Pregunta'), {
            target: { value: '¿Wifi?' }
        });
        fireEvent.change(screen.getByLabelText('Respuesta'), {
            target: { value: 'Sí.' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        // Under the mocked `t`, resolveValidationMessage cannot resolve the
        // zodError key (the mock echoes it back, which reads as "missing"), so
        // the raw schema key reaches the DOM. In production the interpolated
        // "debe tener al menos {{min}} caracteres" copy renders instead — the
        // point under test is that a min-length failure now MARKS the field.
        // ('¿Wifi?' is 6 chars and 'Sí.' is 3 — both under the 10-char min.)
        expect(mockAdd).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Pregunta')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Respuesta')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByText('zodError.common.faq.question.min')).toBeInTheDocument();
        expect(screen.getByText('zodError.common.faq.answer.min')).toBeInTheDocument();
    });

    it('clears a field error as soon as the user edits that field', () => {
        renderSection([]);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        expect(screen.getByText('La pregunta es obligatoria')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Pregunta'), {
            target: { value: '¿Hay wifi en las habitaciones?' }
        });

        expect(screen.queryByText('La pregunta es obligatoria')).not.toBeInTheDocument();
        // The untouched field keeps its error.
        expect(screen.getByText('La respuesta es obligatoria')).toBeInTheDocument();
    });

    it('marks the edit form fields instead of returning silently', () => {
        renderSection([FAQ_1]);
        fireEvent.click(screen.getByRole('button', { name: /^Editar/ }));

        fireEvent.change(screen.getByLabelText('Pregunta'), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        expect(mockUpdate).not.toHaveBeenCalled();
        expect(screen.getByText('La pregunta es obligatoria')).toBeInTheDocument();
        expect(screen.getByLabelText('Pregunta')).toHaveFocus();
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
                answer: 'A partir de las 14hs.',
                isVisibleOnListing: true,
                isUsableByAi: true
            });
        });

        await waitFor(() => {
            expect(screen.getByText('¿A qué hora es el check-in?')).toBeInTheDocument();
        });
    });

    it('seeds the edit form checkboxes from the FAQ current channel-visibility flags', () => {
        const hiddenFaq: AccommodationFaqItem = {
            ...FAQ_1,
            isVisibleOnListing: false,
            isUsableByAi: false
        };
        renderSection([hiddenFaq]);
        fireEvent.click(screen.getByRole('button', { name: /^Editar/ }));

        const visibleCheckbox = screen.getByLabelText(
            'Visible en la ficha pública'
        ) as HTMLInputElement;
        const aiCheckbox = screen.getByLabelText('Usable por la IA') as HTMLInputElement;

        expect(visibleCheckbox.checked).toBe(false);
        expect(aiCheckbox.checked).toBe(false);
    });

    it('opens the delete dialog, and confirming calls .remove and removes the FAQ', async () => {
        mockRemove.mockResolvedValueOnce({ ok: true, data: { success: true } });

        renderSection([FAQ_1, FAQ_2]);
        fireEvent.click(
            screen.getByRole('button', { name: /^Eliminar "¿Cuándo es el check-in\?"/ })
        );

        // The dialog opens and echoes what is about to be deleted — the API is
        // NOT called until the user confirms (HOS-794). The question text now
        // appears twice: once in the row and once in the dialog body.
        expect(mockRemove).not.toHaveBeenCalled();
        expect(screen.getByText('¿Eliminás esta pregunta?')).toBeInTheDocument();
        expect(screen.getAllByText('¿Cuándo es el check-in?')).toHaveLength(2);

        fireEvent.click(screen.getByRole('button', { name: 'Eliminar pregunta' }));

        await waitFor(() => {
            expect(mockRemove).toHaveBeenCalledWith({ accommodationId: 'acc-1', faqId: 'faq-1' });
        });

        await waitFor(() => {
            expect(screen.queryByText('¿Cuándo es el check-in?')).not.toBeInTheDocument();
        });
    });

    it('does NOT call .remove when the delete dialog is cancelled', () => {
        renderSection([FAQ_1]);
        fireEvent.click(screen.getByRole('button', { name: /^Eliminar "/ }));

        expect(screen.getByText('¿Eliminás esta pregunta?')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(mockRemove).not.toHaveBeenCalled();
        expect(screen.queryByText('¿Eliminás esta pregunta?')).not.toBeInTheDocument();
    });

    it('does not use the browser-native window.confirm for deletion (HOS-794)', () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

        renderSection([FAQ_1]);
        fireEvent.click(screen.getByRole('button', { name: /^Eliminar "/ }));

        // The maquetated dialog opened instead of the browser's native confirm.
        expect(screen.getByText('¿Eliminás esta pregunta?')).toBeInTheDocument();
        expect(confirmSpy).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
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

        const { container } = renderSection([FAQ_1, FAQ_2]);
        fireEvent.click(screen.getByRole('button', { name: /^Bajar "¿Cuándo es el check-in\?"/ }));

        await waitFor(() => {
            expect(screen.getByText('No se pudo reordenar.')).toBeInTheDocument();
        });

        // FAQ_1 is still first in DOM order after rollback. Scoped to `.question`
        // elements (not a bare "¿" text match) so the explanatory copy block
        // above the list — which also starts with "¿" — cannot collide.
        const questions = Array.from(container.querySelectorAll('.question')).map(
            (el) => el.textContent
        );
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

    describe('per-row channel-visibility marker (AC-14)', () => {
        it('shows no badge for a FAQ at the all-true default', () => {
            renderSection([FAQ_1]);
            expect(screen.queryByText('No visible en la ficha')).not.toBeInTheDocument();
            expect(screen.queryByText('No usable por IA')).not.toBeInTheDocument();
        });

        it('shows the "not visible" badge, as real text, when isVisibleOnListing is false', () => {
            const hiddenFaq: AccommodationFaqItem = { ...FAQ_1, isVisibleOnListing: false };
            renderSection([hiddenFaq]);

            const badge = screen.getByText('No visible en la ficha');
            expect(badge).toBeInTheDocument();
            // The badge must carry real visible text (not rely on colour alone).
            expect(badge.textContent).toBe('No visible en la ficha');
            expect(screen.queryByText('No usable por IA')).not.toBeInTheDocument();
        });

        it('shows the "not AI-usable" badge when isUsableByAi is false', () => {
            const aiDisabledFaq: AccommodationFaqItem = { ...FAQ_1, isUsableByAi: false };
            renderSection([aiDisabledFaq]);

            expect(screen.getByText('No usable por IA')).toBeInTheDocument();
            expect(screen.queryByText('No visible en la ficha')).not.toBeInTheDocument();
        });

        it('shows BOTH badges for a FAQ with both flags off (the "draft" combination)', () => {
            const draftFaq: AccommodationFaqItem = {
                ...FAQ_1,
                isVisibleOnListing: false,
                isUsableByAi: false
            };
            renderSection([draftFaq]);

            expect(screen.getByText('No visible en la ficha')).toBeInTheDocument();
            expect(screen.getByText('No usable por IA')).toBeInTheDocument();
        });

        it('still renders a FAQ with both flags off — the editor never filters by them', () => {
            // The editor is the management surface, not a consumer (§6.2 of the
            // spec): unlike getBySlug / the AI prompt, it must NOT hide FAQs
            // based on isVisibleOnListing / isUsableByAi.
            const draftFaq: AccommodationFaqItem = {
                ...FAQ_1,
                isVisibleOnListing: false,
                isUsableByAi: false
            };
            renderSection([draftFaq, FAQ_2]);

            expect(screen.getByText('¿Cuándo es el check-in?')).toBeInTheDocument();
            expect(screen.getByText('¿Aceptan mascotas?')).toBeInTheDocument();
        });
    });

    it('renders the explanatory copy block above the list (G-6)', () => {
        renderSection([FAQ_1]);
        expect(screen.getByText('¿Por qué ocultar o restringir una pregunta?')).toBeInTheDocument();
        expect(
            screen.getByText(
                /una pregunta no visible en la ficha pero usable por la IA no es privada/
            )
        ).toBeInTheDocument();
    });
});
