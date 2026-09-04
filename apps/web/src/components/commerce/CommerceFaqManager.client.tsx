/**
 * @file CommerceFaqManager.client.tsx
 * @description Owner FAQ manager island for a commerce listing (SPEC-253 T-024).
 *
 * Provides a full FAQ CRUD UI wired to the protected FAQ endpoints:
 *   POST   /{vertical}/{id}/faqs           — add
 *   PATCH  /{vertical}/{id}/faqs/{faqId}   — update
 *   DELETE /{vertical}/{id}/faqs/{faqId}   — remove
 *   PUT    /{vertical}/{id}/faqs/reorder   — reorder
 *
 * Design:
 * - Lists existing FAQs with inline edit / delete actions and up/down reorder.
 * - An "add" form appended at the bottom; clicking "Agregar pregunta" shows it.
 * - Each FAQ shows question + answer (truncated in list mode, full in edit mode).
 * - Optimistic local reorder (displayOrder) — PUT to /reorder on every move.
 * - This component manages its own async state (loading / error per action).
 *   It does NOT participate in the parent editor's dirty / PATCH payload — FAQs
 *   have their own endpoints and are saved independently. That last point is
 *   what the editor's "No hay cambios para guardar" means when a FAQ is on
 *   screen: the general save button never carried FAQs and never will.
 *
 * HOS-811 — why a blank field is now an ERROR and not a bare `return`.
 * Both submit handlers used to bail out silently when question or answer was
 * empty: no request, no message, no marked field, no state change. That is
 * indistinguishable from a dead button, and it is exactly how the bug was
 * reported ("se aprieta Guardar, y no pasa nada. Ni cartel, ni campo marcado,
 * ni error"). Refusing to submit an empty FAQ is still correct; refusing
 * SILENTLY never is — it leaves the owner with no next move.
 *
 * HOS-400 — the two channel-visibility checkboxes (`isVisibleOnListing` /
 * `isUsableByAi`), adopting the pattern HOS-393 shipped for the accommodation
 * editor (`FaqSection.client.tsx`). Both default to checked, so an owner who
 * ignores them gets exactly the behaviour FAQs had before: published on the
 * listing and fed to the AI chat this PR's companion (HOS-400 PR 1) mounted
 * on gastronomy and experience listings.
 */

import { EyeOffIcon, SparkleIcon } from '@repo/icons';
import { type JSX, useCallback, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import type { CommerceVertical } from '@/lib/commerce/owner-listings';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './CommerceFaqManager.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single FAQ entry as returned by the protected getById endpoint. */
export interface CommerceFaq {
    readonly id: string;
    readonly question: string;
    readonly answer: string;
    readonly category: string | null;
    readonly displayOrder: number | null;
    /**
     * Whether the FAQ appears on the listing's public page. Enforced
     * server-side (HOS-400, adopting the HOS-393 pattern) — this flag is
     * display-only here, the manager never filters by it.
     */
    readonly isVisibleOnListing: boolean;
    /**
     * Whether the AI chat assistant may use this FAQ to answer questions.
     * Enforced where the prompt is assembled (HOS-400). A FAQ that is
     * AI-usable but not `isVisibleOnListing` is NOT private — the assistant
     * will still say it to anyone who asks in chat.
     */
    readonly isUsableByAi: boolean;
}

/**
 * Envelope the add / update endpoints answer with (HOS-841).
 *
 * `ExperienceFaqSingleOutputSchema` and `GastronomyFaqSingleOutputSchema` are
 * both `z.object({ faq: … })`, so the FAQ arrives one level down. Typing these
 * two calls as `CommerceFaq` compiled fine and put the ENVELOPE into the list:
 * `question`/`answer` rendered blank and `id` was `undefined`, which then sent
 * `PUT …/faqs/undefined` (400) on the next edit — while the row had in fact
 * been written. Delete and reorder are unaffected: they answer `SuccessSchema`.
 */
interface CommerceFaqEnvelope {
    readonly faq: CommerceFaq;
}

/** Props for CommerceFaqManager. */
export interface CommerceFaqManagerProps {
    /** Which vertical this listing belongs to (drives the endpoint path). */
    readonly vertical: CommerceVertical;
    /** UUID of the listing. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /** Pre-fetched FAQs from the SSR listing detail (may be empty). */
    readonly initialFaqs: readonly CommerceFaq[];
}

/**
 * Editor state for a single FAQ row: question + answer + category plus the
 * two channel-visibility flags (HOS-400). Both flags default to `true` so a
 * new FAQ behaves exactly as every FAQ did before the flags existed.
 */
interface FaqEditor {
    readonly question: string;
    readonly answer: string;
    readonly category: string;
    readonly isVisibleOnListing: boolean;
    readonly isUsableByAi: boolean;
}

const EMPTY_EDITOR: FaqEditor = {
    question: '',
    answer: '',
    category: '',
    isVisibleOnListing: true,
    isUsableByAi: true
};

/** Per-field validation messages for one FAQ form. */
interface FaqFieldErrors {
    readonly question?: string;
    readonly answer?: string;
}

const NO_FIELD_ERRORS: FaqFieldErrors = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validates one FAQ form, returning a message per offending field.
 *
 * Mirrors the API's own requirement (question and answer are both `notNull`),
 * so a submit this rejects would have been rejected server-side anyway. The
 * point is not the rule — it is that the rejection is now VISIBLE (HOS-811).
 *
 * @param params.values - Current form values.
 * @param params.t - Translator for the messages.
 * @returns One entry per invalid field; empty when the form may be submitted.
 */
function validateFaqEditor({
    values,
    t
}: {
    values: FaqEditor;
    t: (key: string, fallback?: string) => string;
}): FaqFieldErrors {
    const errors: { question?: string; answer?: string } = {};

    if (!values.question.trim()) {
        errors.question = t(
            'commerce.owner.editor.faqManager.questionRequired',
            'Escribí la pregunta antes de guardar.'
        );
    }
    if (!values.answer.trim()) {
        errors.answer = t(
            'commerce.owner.editor.faqManager.answerRequired',
            'Escribí la respuesta antes de guardar.'
        );
    }

    return errors;
}

/** Whether a validation result blocks submission. */
function hasFieldErrors(errors: FaqFieldErrors): boolean {
    return Boolean(errors.question || errors.answer);
}

/** Build the base FAQ endpoint prefix for a given vertical + listing. */
function faqBasePath({
    vertical,
    listingId
}: {
    vertical: CommerceVertical;
    listingId: string;
}): string {
    const entity = vertical === 'gastronomy' ? 'gastronomies' : 'experiences';
    return `/api/v1/protected/${entity}/${listingId}/faqs`;
}

/**
 * Whether a FAQ's channel-visibility flags differ from the default (both
 * `true`). Drives the per-row badge (HOS-400, mirroring HOS-393 AC-14) — the
 * manager lists every FAQ regardless of its flags, so a non-default state
 * must stay visible at a glance, or a hidden FAQ becomes invisible in the
 * very screen meant to manage it.
 */
function hasNonDefaultChannelState(faq: CommerceFaq): boolean {
    return !faq.isVisibleOnListing || !faq.isUsableByAi;
}

/** Sort FAQs by displayOrder ascending (nulls last). */
function sortFaqs(faqs: readonly CommerceFaq[]): readonly CommerceFaq[] {
    return [...faqs].sort((a, b) => {
        if (a.displayOrder === null && b.displayOrder === null) return 0;
        if (a.displayOrder === null) return 1;
        if (b.displayOrder === null) return -1;
        return a.displayOrder - b.displayOrder;
    });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * CommerceFaqManager
 *
 * Owner FAQ management UI — list, add, edit, reorder and delete FAQs for a
 * commerce listing. Each action calls the appropriate protected FAQ endpoint
 * directly (not via the parent editor's PATCH path).
 *
 * @param vertical - Commerce vertical (gastronomy | experience).
 * @param listingId - UUID of the listing.
 * @param locale - Active UI locale.
 * @param initialFaqs - FAQs from the SSR listing detail.
 */
export function CommerceFaqManager({
    vertical,
    listingId,
    locale,
    initialFaqs
}: CommerceFaqManagerProps): JSX.Element {
    const { t } = createTranslations(locale);

    const [faqs, setFaqs] = useState<readonly CommerceFaq[]>(() => sortFaqs(initialFaqs));
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<FaqEditor>(EMPTY_EDITOR);
    const [isAdding, setIsAdding] = useState(false);
    const [addValues, setAddValues] = useState<FaqEditor>(EMPTY_EDITOR);
    const [actionError, setActionError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [addErrors, setAddErrors] = useState<FaqFieldErrors>(NO_FIELD_ERRORS);
    const [editErrors, setEditErrors] = useState<FaqFieldErrors>(NO_FIELD_ERRORS);

    const basePath = faqBasePath({ vertical, listingId });

    // ---------------------------------------------------------------------------
    // Add
    // ---------------------------------------------------------------------------

    const handleAddSubmit = useCallback(async () => {
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
        const result = await apiClient.postProtected<CommerceFaqEnvelope>({
            path: basePath,
            body: {
                question: addValues.question.trim(),
                answer: addValues.answer.trim(),
                category: addValues.category.trim() || undefined,
                isVisibleOnListing: addValues.isVisibleOnListing,
                isUsableByAi: addValues.isUsableByAi
            }
        });

        setBusyId(null);
        if (result.ok) {
            setFaqs((prev) => sortFaqs([...prev, result.data.faq]));
            setAddValues(EMPTY_EDITOR);
            setAddErrors(NO_FIELD_ERRORS);
            setIsAdding(false);
        } else {
            setActionError(
                t('commerce.owner.editor.faqManager.saveError', 'No se pudo guardar la pregunta.')
            );
        }
    }, [addValues, basePath, t]);

    // ---------------------------------------------------------------------------
    // Edit
    // ---------------------------------------------------------------------------

    const startEdit = useCallback((faq: CommerceFaq) => {
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

    const handleEditSubmit = useCallback(
        async (faqId: string) => {
            const validation = validateFaqEditor({ values: editValues, t });
            setEditErrors(validation);
            if (hasFieldErrors(validation)) {
                return;
            }
            setBusyId(faqId);
            setActionError(null);

            // PUT, not PATCH: the API registers `PUT /{id}/faqs/{faqId}`
            // (routes/{gastronomy,experience}/protected/updateFaq.ts). PATCH
            // matched no route and 404'd — H-89.
            const result = await apiClient.put<CommerceFaqEnvelope>({
                path: `${basePath}/${faqId}`,
                body: {
                    question: editValues.question.trim(),
                    answer: editValues.answer.trim(),
                    category: editValues.category.trim() || undefined,
                    isVisibleOnListing: editValues.isVisibleOnListing,
                    isUsableByAi: editValues.isUsableByAi
                }
            });

            setBusyId(null);
            if (result.ok) {
                setFaqs((prev) =>
                    sortFaqs(prev.map((f) => (f.id === faqId ? { ...f, ...result.data.faq } : f)))
                );
                setEditingId(null);
                setEditValues(EMPTY_EDITOR);
                setEditErrors(NO_FIELD_ERRORS);
            } else {
                setActionError(
                    t(
                        'commerce.owner.editor.faqManager.saveError',
                        'No se pudo guardar la pregunta.'
                    )
                );
            }
        },
        [editValues, basePath, t]
    );

    // ---------------------------------------------------------------------------
    // Delete
    // ---------------------------------------------------------------------------

    const handleDelete = useCallback(
        async (faqId: string) => {
            if (
                !window.confirm(
                    t('commerce.owner.editor.faqManager.deleteConfirm', '¿Eliminás esta pregunta?')
                )
            ) {
                return;
            }
            setBusyId(faqId);
            setActionError(null);

            const result = await apiClient.delete<{ success: boolean }>({
                path: `${basePath}/${faqId}`
            });

            setBusyId(null);
            if (result.ok) {
                setFaqs((prev) => prev.filter((f) => f.id !== faqId));
            } else {
                setActionError(
                    t(
                        'commerce.owner.editor.faqManager.deleteError',
                        'No se pudo eliminar la pregunta.'
                    )
                );
            }
        },
        [basePath, t]
    );

    // ---------------------------------------------------------------------------
    // Reorder
    // ---------------------------------------------------------------------------

    const moveItem = useCallback(
        async (index: number, direction: 'up' | 'down') => {
            const arr = [...faqs];
            const swapIndex = direction === 'up' ? index - 1 : index + 1;
            if (swapIndex < 0 || swapIndex >= arr.length) return;

            // Swap in local state optimistically
            const temp = arr[index];
            arr[index] = arr[swapIndex];
            arr[swapIndex] = temp;

            // Assign new displayOrder values
            const reordered: CommerceFaq[] = arr.map((f, i) => ({ ...f, displayOrder: i }));
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
                    t('commerce.owner.editor.faqManager.reorderError', 'No se pudo reordenar.')
                );
            }
        },
        [faqs, basePath, t]
    );

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
                {t('commerce.owner.editor.faqManager.sectionTitle', 'Preguntas frecuentes')}
            </h3>

            <div className={styles.channelIntro}>
                <p className={styles.channelIntroTitle}>
                    {t(
                        'commerce.owner.editor.faqManager.channelIntro.title',
                        '¿Por qué ocultar o restringir una pregunta?'
                    )}
                </p>
                <p className={styles.channelIntroBody}>
                    {t(
                        'commerce.owner.editor.faqManager.channelIntro.body1',
                        '"Visible en la ficha pública" muestra la pregunta en la página del local y en los datos estructurados (JSON-LD) que leen los buscadores. "Usable por la IA" permite que el asistente de chat use esta pregunta para responder consultas.'
                    )}
                </p>
                <p className={styles.channelIntroBody}>
                    {t(
                        'commerce.owner.editor.faqManager.channelIntro.body2',
                        'Destildá "Visible en la ficha pública" para información útil pero que no querés publicar: algo temporal, un margen que preferís no prometer por escrito, o una recomendación que suena mejor en una conversación que en la vidriera.'
                    )}
                </p>
                <p className={styles.channelIntroBody}>
                    {t(
                        'commerce.owner.editor.faqManager.channelIntro.body3',
                        'Destildá "Usable por la IA" para contenido que preferís que se muestre tal cual, sin que el asistente lo parafrasee.'
                    )}
                </p>
                <p className={styles.channelIntroNote}>
                    {t(
                        'commerce.owner.editor.faqManager.channelIntro.body4',
                        'Importante: una pregunta no visible en la ficha pero usable por la IA no es privada. El asistente se la puede decir a cualquiera que pregunte por chat; solo no aparece publicada en la página.'
                    )}
                </p>
            </div>

            {actionError && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {actionError}
                </p>
            )}

            {faqs.length === 0 && !isAdding && (
                <p className={styles.emptyState}>
                    {t(
                        'commerce.owner.editor.faqManager.emptyState',
                        'Todavía no hay preguntas. Agregá la primera.'
                    )}
                </p>
            )}

            <ol className={styles.list}>
                {faqs.map((faq, index) => {
                    const isEditing = editingId === faq.id;
                    const isBusy = busyId === faq.id;

                    return (
                        <li
                            key={faq.id}
                            className={styles.item}
                        >
                            {isEditing ? (
                                /* Edit form */
                                <div className={styles.editForm}>
                                    <label
                                        className={styles.fieldLabel}
                                        htmlFor={`faq-q-${faq.id}`}
                                    >
                                        {t(
                                            'commerce.owner.editor.faqManager.questionLabel',
                                            'Pregunta'
                                        )}
                                    </label>
                                    <textarea
                                        id={`faq-q-${faq.id}`}
                                        className={styles.textarea}
                                        rows={2}
                                        value={editValues.question}
                                        aria-invalid={editErrors.question ? 'true' : undefined}
                                        aria-describedby={
                                            editErrors.question
                                                ? `faq-q-${faq.id}-error`
                                                : undefined
                                        }
                                        placeholder={t(
                                            'commerce.owner.editor.faqManager.questionPlaceholder',
                                            'Escribí la pregunta...'
                                        )}
                                        onChange={(e) =>
                                            setEditValues((v) => ({
                                                ...v,
                                                question: e.target.value
                                            }))
                                        }
                                    />
                                    {editErrors.question && (
                                        <p
                                            id={`faq-q-${faq.id}-error`}
                                            className={styles.fieldError}
                                            role="alert"
                                        >
                                            {editErrors.question}
                                        </p>
                                    )}
                                    <label
                                        className={styles.fieldLabel}
                                        htmlFor={`faq-a-${faq.id}`}
                                    >
                                        {t(
                                            'commerce.owner.editor.faqManager.answerLabel',
                                            'Respuesta'
                                        )}
                                    </label>
                                    <textarea
                                        id={`faq-a-${faq.id}`}
                                        className={styles.textarea}
                                        rows={4}
                                        value={editValues.answer}
                                        aria-invalid={editErrors.answer ? 'true' : undefined}
                                        aria-describedby={
                                            editErrors.answer ? `faq-a-${faq.id}-error` : undefined
                                        }
                                        placeholder={t(
                                            'commerce.owner.editor.faqManager.answerPlaceholder',
                                            'Escribí la respuesta...'
                                        )}
                                        onChange={(e) =>
                                            setEditValues((v) => ({
                                                ...v,
                                                answer: e.target.value
                                            }))
                                        }
                                    />
                                    {editErrors.answer && (
                                        <p
                                            id={`faq-a-${faq.id}-error`}
                                            className={styles.fieldError}
                                            role="alert"
                                        >
                                            {editErrors.answer}
                                        </p>
                                    )}
                                    <div className={styles.channelCheckboxes}>
                                        <label className={styles.checkboxLabel}>
                                            <input
                                                type="checkbox"
                                                checked={editValues.isVisibleOnListing}
                                                onChange={(e) =>
                                                    setEditValues((v) => ({
                                                        ...v,
                                                        isVisibleOnListing: e.target.checked
                                                    }))
                                                }
                                            />
                                            {t(
                                                'commerce.owner.editor.faqManager.visibleOnListingLabel',
                                                'Visible en la ficha pública'
                                            )}
                                        </label>
                                        <label className={styles.checkboxLabel}>
                                            <input
                                                type="checkbox"
                                                checked={editValues.isUsableByAi}
                                                onChange={(e) =>
                                                    setEditValues((v) => ({
                                                        ...v,
                                                        isUsableByAi: e.target.checked
                                                    }))
                                                }
                                            />
                                            {t(
                                                'commerce.owner.editor.faqManager.usableByAiLabel',
                                                'Usable por la IA'
                                            )}
                                        </label>
                                    </div>
                                    <div className={styles.editActions}>
                                        <button
                                            type="button"
                                            className={styles.saveBtn}
                                            disabled={isBusy}
                                            onClick={() => handleEditSubmit(faq.id)}
                                        >
                                            {t(
                                                'commerce.owner.editor.faqManager.saveButton',
                                                'Guardar'
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.cancelBtn}
                                            onClick={cancelEdit}
                                        >
                                            {t(
                                                'commerce.owner.editor.faqManager.cancelButton',
                                                'Cancelar'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Display row */
                                <div className={styles.displayRow}>
                                    <div className={styles.itemContent}>
                                        <p className={styles.question}>{faq.question}</p>
                                        {hasNonDefaultChannelState(faq) && (
                                            <div className={styles.badgeRow}>
                                                {!faq.isVisibleOnListing && (
                                                    <span className={styles.badge}>
                                                        <EyeOffIcon
                                                            size="xs"
                                                            weight="regular"
                                                            aria-hidden="true"
                                                        />
                                                        {t(
                                                            'commerce.owner.editor.faqManager.notVisibleBadge',
                                                            'No visible en la ficha'
                                                        )}
                                                    </span>
                                                )}
                                                {!faq.isUsableByAi && (
                                                    <span className={styles.badge}>
                                                        <SparkleIcon
                                                            size="xs"
                                                            weight="regular"
                                                            aria-hidden="true"
                                                        />
                                                        {t(
                                                            'commerce.owner.editor.faqManager.notAiUsableBadge',
                                                            'No usable por IA'
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <p className={styles.answer}>{faq.answer}</p>
                                    </div>
                                    <div className={styles.itemActions}>
                                        <button
                                            type="button"
                                            className={styles.iconBtn}
                                            aria-label={t(
                                                'commerce.owner.editor.faqManager.moveUp',
                                                'Subir'
                                            )}
                                            disabled={index === 0 || isBusy}
                                            onClick={() => moveItem(index, 'up')}
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.iconBtn}
                                            aria-label={t(
                                                'commerce.owner.editor.faqManager.moveDown',
                                                'Bajar'
                                            )}
                                            disabled={index === faqs.length - 1 || isBusy}
                                            onClick={() => moveItem(index, 'down')}
                                        >
                                            ↓
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.editBtn}
                                            disabled={isBusy}
                                            onClick={() => startEdit(faq)}
                                        >
                                            {t(
                                                'commerce.owner.editor.faqManager.editButton',
                                                'Editar'
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.deleteBtn}
                                            disabled={isBusy}
                                            onClick={() => handleDelete(faq.id)}
                                        >
                                            {t(
                                                'commerce.owner.editor.faqManager.deleteButton',
                                                'Eliminar'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ol>

            {/* Add form */}
            {isAdding ? (
                <div className={styles.addForm}>
                    <label
                        className={styles.fieldLabel}
                        htmlFor="faq-new-q"
                    >
                        {t('commerce.owner.editor.faqManager.questionLabel', 'Pregunta')}
                    </label>
                    <textarea
                        id="faq-new-q"
                        className={styles.textarea}
                        rows={2}
                        value={addValues.question}
                        aria-invalid={addErrors.question ? 'true' : undefined}
                        aria-describedby={addErrors.question ? 'faq-new-q-error' : undefined}
                        placeholder={t(
                            'commerce.owner.editor.faqManager.questionPlaceholder',
                            'Escribí la pregunta...'
                        )}
                        onChange={(e) => setAddValues((v) => ({ ...v, question: e.target.value }))}
                    />
                    {addErrors.question && (
                        <p
                            id="faq-new-q-error"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {addErrors.question}
                        </p>
                    )}
                    <label
                        className={styles.fieldLabel}
                        htmlFor="faq-new-a"
                    >
                        {t('commerce.owner.editor.faqManager.answerLabel', 'Respuesta')}
                    </label>
                    <textarea
                        id="faq-new-a"
                        className={styles.textarea}
                        rows={4}
                        value={addValues.answer}
                        aria-invalid={addErrors.answer ? 'true' : undefined}
                        aria-describedby={addErrors.answer ? 'faq-new-a-error' : undefined}
                        placeholder={t(
                            'commerce.owner.editor.faqManager.answerPlaceholder',
                            'Escribí la respuesta...'
                        )}
                        onChange={(e) => setAddValues((v) => ({ ...v, answer: e.target.value }))}
                    />
                    {addErrors.answer && (
                        <p
                            id="faq-new-a-error"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {addErrors.answer}
                        </p>
                    )}
                    <div className={styles.channelCheckboxes}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={addValues.isVisibleOnListing}
                                onChange={(e) =>
                                    setAddValues((v) => ({
                                        ...v,
                                        isVisibleOnListing: e.target.checked
                                    }))
                                }
                            />
                            {t(
                                'commerce.owner.editor.faqManager.visibleOnListingLabel',
                                'Visible en la ficha pública'
                            )}
                        </label>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={addValues.isUsableByAi}
                                onChange={(e) =>
                                    setAddValues((v) => ({
                                        ...v,
                                        isUsableByAi: e.target.checked
                                    }))
                                }
                            />
                            {t(
                                'commerce.owner.editor.faqManager.usableByAiLabel',
                                'Usable por la IA'
                            )}
                        </label>
                    </div>
                    <div className={styles.editActions}>
                        <button
                            type="button"
                            className={styles.saveBtn}
                            disabled={busyId === 'add'}
                            onClick={handleAddSubmit}
                        >
                            {t('commerce.owner.editor.faqManager.saveButton', 'Guardar')}
                        </button>
                        <button
                            type="button"
                            className={styles.cancelBtn}
                            onClick={() => {
                                setIsAdding(false);
                                setAddValues(EMPTY_EDITOR);
                                setAddErrors(NO_FIELD_ERRORS);
                            }}
                        >
                            {t('commerce.owner.editor.faqManager.cancelButton', 'Cancelar')}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() => setIsAdding(true)}
                >
                    {t('commerce.owner.editor.faqManager.addButton', 'Agregar pregunta')}
                </button>
            )}
        </section>
    );
}
