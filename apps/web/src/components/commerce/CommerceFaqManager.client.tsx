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
 *   have their own endpoints and are saved independently.
 */
import { apiClient } from '@/lib/api/client';
import type { CommerceVertical } from '@/lib/commerce/owner-listings';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type JSX, useCallback, useState } from 'react';
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

/** Editor state for a single FAQ row. */
interface FaqEditor {
    readonly question: string;
    readonly answer: string;
    readonly category: string;
}

const EMPTY_EDITOR: FaqEditor = { question: '', answer: '', category: '' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the base FAQ endpoint prefix for a given vertical + listing. */
function faqBasePath({
    vertical,
    listingId
}: { vertical: CommerceVertical; listingId: string }): string {
    const entity = vertical === 'gastronomy' ? 'gastronomies' : 'experiences';
    return `/api/v1/protected/${entity}/${listingId}/faqs`;
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

    const basePath = faqBasePath({ vertical, listingId });

    // ---------------------------------------------------------------------------
    // Add
    // ---------------------------------------------------------------------------

    const handleAddSubmit = useCallback(async () => {
        if (!addValues.question.trim() || !addValues.answer.trim()) {
            return;
        }
        setBusyId('add');
        setActionError(null);

        const result = await apiClient.post<CommerceFaq>({
            path: basePath,
            body: {
                question: addValues.question.trim(),
                answer: addValues.answer.trim(),
                category: addValues.category.trim() || undefined
            }
        });

        setBusyId(null);
        if (result.ok) {
            setFaqs((prev) => sortFaqs([...prev, result.data]));
            setAddValues(EMPTY_EDITOR);
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
            category: faq.category ?? ''
        });
        setActionError(null);
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingId(null);
        setEditValues(EMPTY_EDITOR);
    }, []);

    const handleEditSubmit = useCallback(
        async (faqId: string) => {
            if (!editValues.question.trim() || !editValues.answer.trim()) {
                return;
            }
            setBusyId(faqId);
            setActionError(null);

            const result = await apiClient.patch<CommerceFaq>({
                path: `${basePath}/${faqId}`,
                body: {
                    question: editValues.question.trim(),
                    answer: editValues.answer.trim(),
                    category: editValues.category.trim() || undefined
                }
            });

            setBusyId(null);
            if (result.ok) {
                setFaqs((prev) =>
                    sortFaqs(prev.map((f) => (f.id === faqId ? { ...f, ...result.data } : f)))
                );
                setEditingId(null);
                setEditValues(EMPTY_EDITOR);
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
                        placeholder={t(
                            'commerce.owner.editor.faqManager.questionPlaceholder',
                            'Escribí la pregunta...'
                        )}
                        onChange={(e) => setAddValues((v) => ({ ...v, question: e.target.value }))}
                    />
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
                        placeholder={t(
                            'commerce.owner.editor.faqManager.answerPlaceholder',
                            'Escribí la respuesta...'
                        )}
                        onChange={(e) => setAddValues((v) => ({ ...v, answer: e.target.value }))}
                    />
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
