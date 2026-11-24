/**
 * State and requests of the listing FAQ manager (SPEC-253 T-024, HOS-2490).
 *
 * Save model is `auto`: every action (add, edit, remove, move) calls its
 * protected endpoint immediately. Nothing here participates in the parent
 * editor's dirty state or PATCH payload — FAQs have their own endpoints.
 *
 *   POST   /{vertical}/{id}/faqs           add
 *   PUT    /{vertical}/{id}/faqs/{faqId}   update
 *   DELETE /{vertical}/{id}/faqs/{faqId}   remove
 *   PUT    /{vertical}/{id}/faqs/reorder   reorder
 *
 * @module components/listing/use-listing-faq-manager
 */

import { useCallback, useState } from 'react';
import { type FaqAiDraftState, useFaqAiDraft } from '@/hooks/use-faq-ai-draft';
import { useFaqPrefill } from '@/hooks/use-faq-prefill';
import { apiClient } from '@/lib/api/client';
import { translateApiError } from '@/lib/api-errors';
import { createTranslations, type SupportedLocale, type TranslationFn } from '@/lib/i18n';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';
import { webLogger } from '@/lib/logger';
import {
    buildFaqBody,
    EMPTY_EDITOR,
    type FaqEditor,
    type FaqFieldErrors,
    faqBasePath,
    hasFieldErrors,
    type ListingFaq,
    type ListingFaqEnvelope,
    NO_FIELD_ERRORS,
    sortFaqs,
    validateFaqEditor
} from './listing-faq-helpers';

/** Input of {@link useListingFaqManager}. */
export interface UseListingFaqManagerInput {
    /** Which vertical this listing belongs to (drives the endpoint path). */
    readonly vertical: VenueOrExperience;
    /** UUID of the listing. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /** Pre-fetched FAQs from the SSR listing detail (may be empty). */
    readonly initialFaqs: readonly ListingFaq[];
}

/** Everything the manager's view needs. */
export interface UseListingFaqManagerResult {
    readonly t: TranslationFn;
    readonly faqs: readonly ListingFaq[];
    readonly actionError: string | null;
    /** Id of the row in flight, `'add'` for the add form, `null` when idle. */
    readonly busyId: string | null;
    readonly editingId: string | null;
    readonly editValues: FaqEditor;
    readonly editErrors: FaqFieldErrors;
    readonly isAdding: boolean;
    readonly addValues: FaqEditor;
    readonly addErrors: FaqFieldErrors;
    readonly prefillMessageId: string | null;
    readonly faqAiDraft: FaqAiDraftState;
    readonly isAiDraftContent: boolean;
    readonly setEditValues: (updater: (values: FaqEditor) => FaqEditor) => void;
    readonly setAddValues: (updater: (values: FaqEditor) => FaqEditor) => void;
    readonly startAdd: () => void;
    readonly cancelAdd: () => void;
    readonly submitAdd: () => Promise<void>;
    readonly startEdit: (faq: ListingFaq) => void;
    readonly cancelEdit: () => void;
    readonly submitEdit: (faqId: string) => Promise<void>;
    /** Deletes the FAQ at `index`; the confirmation is the caller's job. */
    readonly removeAt: (index: number) => Promise<void>;
    /** Moves the FAQ at `index` by one position and persists the order. */
    readonly moveAt: (index: number, delta: -1 | 1) => Promise<void>;
    /** Applies an AI-suggested answer to the add form. */
    readonly applyAiDraft: (draft: string) => void;
}

/**
 * State machine of the FAQ manager: list, add form, edit form, busy and error.
 *
 * @param input - See {@link UseListingFaqManagerInput}.
 * @returns State plus the handlers the view wires up.
 */
export function useListingFaqManager({
    vertical,
    listingId,
    locale,
    initialFaqs
}: UseListingFaqManagerInput): UseListingFaqManagerResult {
    const { t } = createTranslations(locale);

    const [faqs, setFaqs] = useState<readonly ListingFaq[]>(() => sortFaqs(initialFaqs));
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<FaqEditor>(EMPTY_EDITOR);
    const [editErrors, setEditErrors] = useState<FaqFieldErrors>(NO_FIELD_ERRORS);
    const [isAdding, setIsAdding] = useState(false);
    const [addValues, setAddValues] = useState<FaqEditor>(EMPTY_EDITOR);
    const [addErrors, setAddErrors] = useState<FaqFieldErrors>(NO_FIELD_ERRORS);
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

    const basePath = faqBasePath({ vertical, listingId });

    /** Surfaces the server's reason (plan / coverage / permission), HOS-2428. */
    const saveFailure = useCallback(
        (error: Parameters<typeof translateApiError>[0]['error']) =>
            translateApiError({
                error,
                t,
                fallback: t(
                    'listing.owner.editor.faqManager.saveError',
                    'No se pudo guardar la pregunta.'
                )
            }),
        [t]
    );

    // -- Add ------------------------------------------------------------------

    const startAdd = useCallback(() => setIsAdding(true), []);

    const cancelAdd = useCallback(() => {
        setIsAdding(false);
        setAddValues(EMPTY_EDITOR);
        setAddErrors(NO_FIELD_ERRORS);
    }, []);

    const submitAdd = useCallback(async () => {
        const validation = validateFaqEditor({ values: addValues, t });
        setAddErrors(validation);
        if (hasFieldErrors(validation)) {
            return;
        }
        setBusyId('add');
        setActionError(null);

        // `postProtected`, never `post`: this hits `/protected/`, and `post` is the
        // ONE verb on the client that omits `credentials: 'include'` (patch, put
        // and delete all send it). Using it made every add 403 — H-89.
        const result = await apiClient.postProtected<ListingFaqEnvelope>({
            path: basePath,
            body: buildFaqBody(addValues)
        });

        setBusyId(null);
        if (!result.ok) {
            setActionError(saveFailure(result.error));
            return;
        }
        setFaqs((prev) => sortFaqs([...prev, result.data.faq]));
        setAddValues(EMPTY_EDITOR);
        setAddErrors(NO_FIELD_ERRORS);
        setIsAdding(false);
        if (prefillMessageId) {
            void apiClient
                .postProtected({
                    path: `/api/v1/protected/ai/listing-questions/${prefillMessageId}/dismiss`
                })
                .then((dismissResult) => {
                    if (!dismissResult.ok)
                        webLogger.warn('[ListingFaqManager] question dismissal failed');
                })
                .catch(() => webLogger.warn('[ListingFaqManager] question dismissal failed'));
            setPrefillMessageId(null);
        }
    }, [addValues, basePath, t, prefillMessageId, saveFailure]);

    const applyAiDraft = useCallback((draft: string) => {
        setAddValues((values) => ({ ...values, answer: draft }));
        setIsAiDraftContent(true);
    }, []);

    // -- Edit -----------------------------------------------------------------

    const startEdit = useCallback((faq: ListingFaq) => {
        setEditingId(faq.id);
        setEditValues({
            question: faq.question,
            answer: faq.answer,
            category: faq.category ?? '',
            isVisibleOnListing: faq.isVisibleOnListing,
            isUsableByAi: faq.isUsableByAi
        });
        setActionError(null);
        setEditErrors(NO_FIELD_ERRORS);
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingId(null);
        setEditValues(EMPTY_EDITOR);
        setEditErrors(NO_FIELD_ERRORS);
    }, []);

    const submitEdit = useCallback(
        async (faqId: string) => {
            const validation = validateFaqEditor({ values: editValues, t });
            setEditErrors(validation);
            if (hasFieldErrors(validation)) {
                return;
            }
            setBusyId(faqId);
            setActionError(null);

            // PUT, not PATCH: the API registers `PUT /{id}/faqs/{faqId}`
            // (routes/{venue,experience}/protected/updateFaq.ts). PATCH
            // matched no route and 404'd — H-89.
            const result = await apiClient.put<ListingFaqEnvelope>({
                path: `${basePath}/${faqId}`,
                body: buildFaqBody(editValues)
            });

            setBusyId(null);
            if (!result.ok) {
                setActionError(saveFailure(result.error));
                return;
            }
            setFaqs((prev) =>
                sortFaqs(prev.map((f) => (f.id === faqId ? { ...f, ...result.data.faq } : f)))
            );
            setEditingId(null);
            setEditValues(EMPTY_EDITOR);
            setEditErrors(NO_FIELD_ERRORS);
        },
        [editValues, basePath, t, saveFailure]
    );

    // -- Remove ---------------------------------------------------------------

    const removeAt = useCallback(
        async (index: number) => {
            const faq = faqs[index];
            if (!faq) {
                return;
            }
            setBusyId(faq.id);
            setActionError(null);

            const result = await apiClient.delete<{ success: boolean }>({
                path: `${basePath}/${faq.id}`
            });

            setBusyId(null);
            if (result.ok) {
                setFaqs((prev) => prev.filter((f) => f.id !== faq.id));
            } else {
                setActionError(
                    t(
                        'listing.owner.editor.faqManager.deleteError',
                        'No se pudo eliminar la pregunta.'
                    )
                );
            }
        },
        [faqs, basePath, t]
    );

    // -- Reorder --------------------------------------------------------------

    const moveAt = useCallback(
        async (index: number, delta: -1 | 1) => {
            const arr = [...faqs];
            const swapIndex = index + delta;
            if (swapIndex < 0 || swapIndex >= arr.length) return;

            // Swap in local state optimistically
            const temp = arr[index];
            arr[index] = arr[swapIndex];
            arr[swapIndex] = temp;

            // Assign new displayOrder values
            const reordered: ListingFaq[] = arr.map((f, i) => ({ ...f, displayOrder: i }));
            setFaqs(reordered);
            setActionError(null);

            const result = await apiClient.put<{ success: boolean }>({
                path: `${basePath}/reorder`,
                body: {
                    order: reordered.map((f) => ({
                        faqId: f.id,
                        displayOrder: f.displayOrder ?? 0
                    }))
                }
            });

            if (!result.ok) {
                // Rollback
                setFaqs(sortFaqs(faqs));
                setActionError(
                    t('listing.owner.editor.faqManager.reorderError', 'No se pudo reordenar.')
                );
            }
        },
        [faqs, basePath, t]
    );

    return {
        t,
        faqs,
        actionError,
        busyId,
        editingId,
        editValues,
        editErrors,
        isAdding,
        addValues,
        addErrors,
        prefillMessageId,
        faqAiDraft,
        isAiDraftContent,
        setEditValues,
        setAddValues,
        startAdd,
        cancelAdd,
        submitAdd,
        startEdit,
        cancelEdit,
        submitEdit,
        removeAt,
        moveAt,
        applyAiDraft
    };
}
