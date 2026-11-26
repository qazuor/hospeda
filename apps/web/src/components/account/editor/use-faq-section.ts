/**
 * @file use-faq-section.ts
 * @description State and requests of the shared owner FAQ editor (HOS-2643).
 * Every action persists immediately through its injected adapter
 * (`auto` save model): nothing here flows through the parent
 * editor's PATCH payload or dirty tracking.
 */

import { useCallback, useState } from 'react';
import { useFaqAiDraft } from '@/hooks/use-faq-ai-draft';
import { useFaqPrefill } from '@/hooks/use-faq-prefill';
import { apiClient } from '@/lib/api/client';
import type { FaqPersistence } from '@/lib/api/faq-persistence';
import { translateApiError } from '@/lib/api-errors';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { addToast } from '@/store/toast-store';
import {
    buildFaqBody,
    EMPTY_FAQ_EDITOR,
    type FaqConfig,
    type FaqEditor,
    type FaqFieldErrors,
    type ListingFaq,
    sortFaqs,
    validateFaqEditorValues
} from './faq-model';

/** Options of {@link useFaqSection}. */
export interface UseFaqSectionInput extends FaqConfig {
    readonly locale: SupportedLocale;
    readonly persistence: FaqPersistence;
    /** Pre-fetched FAQs from the SSR editor page (may be empty). */
    readonly initialFaqs: readonly ListingFaq[];
}

/**
 * Owns the FAQ list, the add/edit forms and every request of the FAQ editor.
 *
 * @param input - See {@link UseFaqSectionInput}.
 * @returns The state, its setters and the action handlers.
 */
export function useFaqSection({ locale, persistence, initialFaqs, ...config }: UseFaqSectionInput) {
    const { t } = createTranslations(locale);
    const { namespace, showCategory, errorSurface, validationMode } = config;

    const [faqs, setFaqs] = useState<readonly ListingFaq[]>(() => sortFaqs({ faqs: initialFaqs }));
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<FaqEditor>(EMPTY_FAQ_EDITOR);
    const [editFieldErrors, setEditFieldErrors] = useState<FaqFieldErrors>({});
    const [isAdding, setIsAdding] = useState(false);
    const [addValues, setAddValues] = useState<FaqEditor>(EMPTY_FAQ_EDITOR);
    const [addFieldErrors, setAddFieldErrors] = useState<FaqFieldErrors>({});
    const faqAiDraft = useFaqAiDraft({ locale });
    const [isAiDraftContent, setIsAiDraftContent] = useState(false);
    const [prefillMessageId, setPrefillMessageId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    // HOS-2101: «Agregar como pregunta frecuente» from the AI questions tab.
    useFaqPrefill({
        onPrefill: useCallback(
            (prefill: { question: string; answer: string; messageId: string | null }) => {
                setAddValues((values) => ({
                    ...values,
                    question: prefill.question,
                    answer: prefill.answer
                }));
                setPrefillMessageId(prefill.messageId);
                setIsAdding(true);
            },
            []
        )
    });

    const reportError = useCallback(
        (message: string) => {
            setActionError(message);
            if (errorSurface === 'toast') addToast({ type: 'error', message });
        },
        [errorSurface]
    );

    /**
     * Publishes a failed validation: marks the fields inline, fires the shared
     * "Revisá los campos marcados" toast and focuses the first invalid field
     * (HOS-373, HOS-794).
     *
     * @returns `true` when errors were found (the caller should abort).
     */
    const reportValidationErrors = useCallback(
        (errors: FaqFieldErrors, mode: 'add' | 'edit', faqId?: string) => {
            if (errors.question === undefined && errors.answer === undefined) {
                return false;
            }

            if (mode === 'add') {
                setAddFieldErrors(errors);
            } else {
                setEditFieldErrors(errors);
            }

            if (validationMode !== 'schema') return true;
            addToast({
                type: 'error',
                message: t('validation.formHasErrors', 'Revisá los campos marcados')
            });

            const firstInvalidId =
                errors.question === undefined
                    ? mode === 'add'
                        ? 'faq-new-a'
                        : `faq-a-${faqId}`
                    : mode === 'add'
                      ? 'faq-new-q'
                      : `faq-q-${faqId}`;
            document.getElementById(firstInvalidId)?.focus();

            return true;
        },
        [t, validationMode]
    );

    /** HOS-2428: surface the server's reason instead of one generic line. */
    const saveErrorMessage = useCallback(
        (error: Parameters<typeof translateApiError>[0]['error']) =>
            translateApiError({
                error,
                t,
                fallback: t(`${namespace}.saveError`, 'No se pudo guardar la pregunta.')
            }),
        [t, namespace]
    );

    // -- Add ---------------------------------------------------------------

    const startAdd = useCallback(() => {
        setIsAdding(true);
        if (validationMode === 'schema') setAddFieldErrors({});
    }, [validationMode]);

    const cancelAdd = useCallback(() => {
        setIsAdding(false);
        setAddValues(EMPTY_FAQ_EDITOR);
        setAddFieldErrors({});
    }, []);

    const handleAddSubmit = useCallback(async () => {
        if (
            reportValidationErrors(
                validateFaqEditorValues({
                    values: addValues,
                    t,
                    config: { namespace, showCategory, errorSurface, validationMode }
                }),
                'add'
            )
        ) {
            return;
        }

        setBusyId('add');
        setActionError(null);
        setAddFieldErrors({});

        const result = await persistence.add(buildFaqBody({ values: addValues, showCategory }));

        setBusyId(null);
        if (result.ok) {
            setFaqs((prev) => sortFaqs({ faqs: [...prev, result.data.faq] }));
            setAddValues(EMPTY_FAQ_EDITOR);
            setAddFieldErrors({});
            setIsAdding(false);
            if (prefillMessageId) {
                void apiClient
                    .postProtected({
                        path: `/api/v1/protected/ai/listing-questions/${prefillMessageId}/dismiss`
                    })
                    .then((dismissResult) => {
                        if (!dismissResult.ok)
                            webLogger.warn('[FaqSection] question dismissal failed');
                    })
                    .catch(() => webLogger.warn('[FaqSection] question dismissal failed'));
                setPrefillMessageId(null);
            }
        } else {
            webLogger.warn('[FaqSection] add failed:', result.error);
            reportError(saveErrorMessage(result.error));
        }
    }, [
        addValues,
        persistence,
        namespace,
        showCategory,
        errorSurface,
        validationMode,
        t,
        reportError,
        reportValidationErrors,
        prefillMessageId,
        saveErrorMessage
    ]);

    // -- Edit --------------------------------------------------------------

    const startEdit = useCallback((faq: ListingFaq) => {
        setEditingId(faq.id);
        setEditValues({
            question: faq.question,
            answer: faq.answer,
            category: faq.category ?? '',
            isVisibleOnListing: faq.isVisibleOnListing,
            isUsableByAi: faq.isUsableByAi
        });
        setEditFieldErrors({});
        setActionError(null);
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingId(null);
        setEditValues(EMPTY_FAQ_EDITOR);
        setEditFieldErrors({});
    }, []);

    const handleEditSubmit = useCallback(
        async (faqId: string) => {
            if (
                reportValidationErrors(
                    validateFaqEditorValues({
                        values: editValues,
                        t,
                        config: { namespace, showCategory, errorSurface, validationMode }
                    }),
                    'edit',
                    faqId
                )
            ) {
                return;
            }

            setBusyId(faqId);
            setActionError(null);
            setEditFieldErrors({});

            const result = await persistence.update({
                faqId,
                body: buildFaqBody({ values: editValues, showCategory })
            });

            setBusyId(null);
            if (result.ok) {
                setFaqs((prev) =>
                    sortFaqs({
                        faqs: prev.map((f) => (f.id === faqId ? { ...f, ...result.data.faq } : f))
                    })
                );
                setEditingId(null);
                setEditValues(EMPTY_FAQ_EDITOR);
                setEditFieldErrors({});
            } else {
                webLogger.warn('[FaqSection] update failed:', result.error);
                reportError(saveErrorMessage(result.error));
            }
        },
        [
            editValues,
            persistence,
            namespace,
            showCategory,
            errorSurface,
            validationMode,
            t,
            reportError,
            reportValidationErrors,
            saveErrorMessage
        ]
    );

    // -- Remove (the Repeater asks for confirmation first) -------------------

    const removeAt = useCallback(
        async (index: number) => {
            const faq = faqs[index];
            if (!faq) return;
            setBusyId(faq.id);
            setActionError(null);

            const result = await persistence.remove({ faqId: faq.id });

            setBusyId(null);
            if (result.ok) {
                setFaqs((prev) => prev.filter((f) => f.id !== faq.id));
                if (validationMode === 'schema' && editingId === faq.id) cancelEdit();
            } else {
                webLogger.warn('[FaqSection] remove failed:', result.error);
                reportError(t(`${namespace}.deleteError`, 'No se pudo eliminar la pregunta.'));
            }
        },
        [faqs, persistence, namespace, validationMode, editingId, cancelEdit, t, reportError]
    );

    // -- Reorder -----------------------------------------------------------

    const moveItem = useCallback(
        async (index: number, delta: -1 | 1) => {
            const swapIndex = index + delta;
            const arr = [...faqs];
            const current = arr[index];
            const other = arr[swapIndex];
            if (!current || !other) return;

            const previous = faqs;
            arr[index] = other;
            arr[swapIndex] = current;

            // Swap in local state optimistically.
            const reordered: ListingFaq[] = arr.map((f, i) => ({
                ...f,
                displayOrder: i
            }));
            setFaqs(reordered);
            setActionError(null);

            const result = await persistence.reorder({
                order: reordered.map((f) => ({ faqId: f.id, displayOrder: f.displayOrder ?? 0 }))
            });

            if (!result.ok) {
                webLogger.warn('[FaqSection] reorder failed:', result.error);
                setFaqs(sortFaqs({ faqs: previous }));
                reportError(t(`${namespace}.reorderError`, 'No se pudo reordenar.'));
            }
        },
        [faqs, persistence, namespace, t, reportError]
    );

    return {
        t,
        faqs,
        busyId,
        actionError,
        editingId,
        editValues,
        setEditValues,
        editFieldErrors,
        setEditFieldErrors,
        isAdding,
        addValues,
        setAddValues,
        addFieldErrors,
        setAddFieldErrors,
        faqAiDraft,
        isAiDraftContent,
        setIsAiDraftContent,
        prefillMessageId,
        startAdd,
        cancelAdd,
        handleAddSubmit,
        startEdit,
        cancelEdit,
        handleEditSubmit,
        removeAt,
        moveItem
    } as const;
}
