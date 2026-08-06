/**
 * @file FaqSection.client.tsx
 * @description Self-contained FAQ manager for the accommodation editor (HOS-393).
 *
 * Modeled on `CommerceFaqManager.client.tsx` (SPEC-253) but styled as a card
 * of `src/components/host/editor/` (fieldset + legend, matching
 * `AmenitiesSection.client.tsx`), and wired against the accommodation-scoped
 * FAQ endpoints:
 *   GET    /accommodations/{id}/faqs           — list (SSR-preloaded via `initialFaqs`)
 *   POST   /accommodations/{id}/faqs           — add
 *   PUT    /accommodations/{id}/faqs/{faqId}   — update
 *   DELETE /accommodations/{id}/faqs/{faqId}   — remove
 *   PUT    /accommodations/{id}/faqs/reorder   — reorder
 *
 * AC-2 (HOS-393): this component owns its own async state (loading/error per
 * action) and does NOT participate in the parent editor's dirty-tracking or
 * PATCH payload — every FAQ mutation persists immediately against its own
 * endpoint. Saving a FAQ never requires pressing the editor's main "Guardar"
 * button, and never trips the unsaved-changes guard (HOS-373).
 *
 * Accessibility: the reorder/edit/delete buttons are per-item and would
 * otherwise share an identical accessible name across every row (a real bug
 * already hit in `CommerceFaqManager` — four action pairs all named "Subir" /
 * "Bajar" / "Editar" / "Eliminar" with nothing to tell rows apart). Every
 * action button's `aria-label` here embeds a truncated snippet of the FAQ's
 * own question so each row's controls stay uniquely named.
 */

import { AddIcon, ChevronDownIcon, ChevronUpIcon, DeleteIcon, EditIcon } from '@repo/icons';
import { type JSX, useCallback, useState } from 'react';
import { type AccommodationFaqItem, accommodationFaqApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { addToast } from '@/store/toast-store';
import styles from './FaqSection.module.css';

// Re-export for consumers (the SSR page needs the type for `initialFaqs`).
export type { AccommodationFaqItem };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for FaqSection. */
export interface FaqSectionProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    /** Pre-fetched FAQs from the SSR editor page (may be empty). */
    readonly initialFaqs: readonly AccommodationFaqItem[];
}

/** Editor state for a single FAQ row (question + answer only — see below). */
interface FaqEditor {
    readonly question: string;
    readonly answer: string;
}

const EMPTY_EDITOR: FaqEditor = { question: '', answer: '' };

/** Max characters of the question echoed into per-row action `aria-label`s. */
const LABEL_SNIPPET_MAX = 40;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sort FAQs by displayOrder ascending (nulls last). */
function sortFaqs(faqs: readonly AccommodationFaqItem[]): readonly AccommodationFaqItem[] {
    return [...faqs].sort((a, b) => {
        if (a.displayOrder === null && b.displayOrder === null) return 0;
        if (a.displayOrder === null) return 1;
        if (b.displayOrder === null) return -1;
        return a.displayOrder - b.displayOrder;
    });
}

/**
 * Truncates a FAQ question to a short snippet suitable for embedding inside
 * an `aria-label`, so repeated action buttons (one set per row) get unique
 * accessible names instead of colliding on "Subir" / "Editar" / etc.
 */
function toLabelSnippet(question: string): string {
    const trimmed = question.trim();
    if (trimmed.length <= LABEL_SNIPPET_MAX) {
        return trimmed;
    }
    return `${trimmed.slice(0, LABEL_SNIPPET_MAX).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * FaqSection
 *
 * Owner FAQ management UI for the accommodation editor — list, add, edit,
 * reorder and delete FAQs. Each action calls the accommodation FAQ endpoint
 * directly; nothing here flows through the parent editor's PATCH payload.
 */
export function FaqSection({ locale, accommodationId, initialFaqs }: FaqSectionProps): JSX.Element {
    const { t } = createTranslations(locale);

    const [faqs, setFaqs] = useState<readonly AccommodationFaqItem[]>(() => sortFaqs(initialFaqs));
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<FaqEditor>(EMPTY_EDITOR);
    const [isAdding, setIsAdding] = useState(false);
    const [addValues, setAddValues] = useState<FaqEditor>(EMPTY_EDITOR);
    const [actionError, setActionError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const reportError = useCallback((message: string) => {
        setActionError(message);
        addToast({ type: 'error', message });
    }, []);

    // ---------------------------------------------------------------------------
    // Add
    // ---------------------------------------------------------------------------

    const handleAddSubmit = useCallback(async () => {
        if (!addValues.question.trim() || !addValues.answer.trim()) {
            return;
        }
        setBusyId('add');
        setActionError(null);

        const result = await accommodationFaqApi.add({
            accommodationId,
            question: addValues.question.trim(),
            answer: addValues.answer.trim()
        });

        setBusyId(null);
        if (result.ok) {
            setFaqs((prev) => sortFaqs([...prev, result.data.faq]));
            setAddValues(EMPTY_EDITOR);
            setIsAdding(false);
        } else {
            webLogger.warn('[FaqSection] add failed:', result.error);
            reportError(
                t('host.properties.editor.faq.saveError', 'No se pudo guardar la pregunta.')
            );
        }
    }, [addValues, accommodationId, t, reportError]);

    // ---------------------------------------------------------------------------
    // Edit
    // ---------------------------------------------------------------------------

    const startEdit = useCallback((faq: AccommodationFaqItem) => {
        setEditingId(faq.id);
        setEditValues({ question: faq.question, answer: faq.answer });
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

            const result = await accommodationFaqApi.update({
                accommodationId,
                faqId,
                question: editValues.question.trim(),
                answer: editValues.answer.trim()
            });

            setBusyId(null);
            if (result.ok) {
                setFaqs((prev) =>
                    sortFaqs(prev.map((f) => (f.id === faqId ? { ...f, ...result.data.faq } : f)))
                );
                setEditingId(null);
                setEditValues(EMPTY_EDITOR);
            } else {
                webLogger.warn('[FaqSection] update failed:', result.error);
                reportError(
                    t('host.properties.editor.faq.saveError', 'No se pudo guardar la pregunta.')
                );
            }
        },
        [editValues, accommodationId, t, reportError]
    );

    // ---------------------------------------------------------------------------
    // Delete
    // ---------------------------------------------------------------------------

    const handleDelete = useCallback(
        async (faq: AccommodationFaqItem) => {
            if (
                !window.confirm(
                    t('host.properties.editor.faq.deleteConfirm', '¿Eliminás esta pregunta?')
                )
            ) {
                return;
            }
            setBusyId(faq.id);
            setActionError(null);

            const result = await accommodationFaqApi.remove({ accommodationId, faqId: faq.id });

            setBusyId(null);
            if (result.ok) {
                setFaqs((prev) => prev.filter((f) => f.id !== faq.id));
            } else {
                webLogger.warn('[FaqSection] remove failed:', result.error);
                reportError(
                    t('host.properties.editor.faq.deleteError', 'No se pudo eliminar la pregunta.')
                );
            }
        },
        [accommodationId, t, reportError]
    );

    // ---------------------------------------------------------------------------
    // Reorder
    // ---------------------------------------------------------------------------

    const moveItem = useCallback(
        async (index: number, direction: 'up' | 'down') => {
            const arr = [...faqs];
            const swapIndex = direction === 'up' ? index - 1 : index + 1;
            if (swapIndex < 0 || swapIndex >= arr.length) return;

            const previous = faqs;

            // Swap in local state optimistically.
            const temp = arr[index];
            const other = arr[swapIndex];
            if (!temp || !other) return;
            arr[index] = other;
            arr[swapIndex] = temp;

            const reordered: AccommodationFaqItem[] = arr.map((f, i) => ({
                ...f,
                displayOrder: i
            }));
            setFaqs(reordered);
            setActionError(null);

            const result = await accommodationFaqApi.reorder({
                accommodationId,
                order: reordered.map((f) => ({ faqId: f.id, displayOrder: f.displayOrder ?? 0 }))
            });

            if (!result.ok) {
                webLogger.warn('[FaqSection] reorder failed:', result.error);
                setFaqs(sortFaqs(previous));
                reportError(t('host.properties.editor.faq.reorderError', 'No se pudo reordenar.'));
            }
        },
        [faqs, accommodationId, t, reportError]
    );

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.faqs', 'Preguntas frecuentes')}
            </legend>

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
                        'host.properties.editor.faq.emptyState',
                        'Todavía no hay preguntas. Agregá la primera.'
                    )}
                </p>
            )}

            <ol className={styles.list}>
                {faqs.map((faq, index) => {
                    const isEditing = editingId === faq.id;
                    const isBusy = busyId === faq.id;
                    const snippet = toLabelSnippet(faq.question);

                    return (
                        <li
                            key={faq.id}
                            className={styles.item}
                        >
                            {isEditing ? (
                                <div className={styles.editForm}>
                                    <label
                                        className={styles.fieldLabel}
                                        htmlFor={`faq-q-${faq.id}`}
                                    >
                                        {t('host.properties.editor.faq.questionLabel', 'Pregunta')}
                                    </label>
                                    <textarea
                                        id={`faq-q-${faq.id}`}
                                        className={styles.textarea}
                                        rows={2}
                                        value={editValues.question}
                                        placeholder={t(
                                            'host.properties.editor.faq.questionPlaceholder',
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
                                        {t('host.properties.editor.faq.answerLabel', 'Respuesta')}
                                    </label>
                                    <textarea
                                        id={`faq-a-${faq.id}`}
                                        className={styles.textarea}
                                        rows={4}
                                        value={editValues.answer}
                                        placeholder={t(
                                            'host.properties.editor.faq.answerPlaceholder',
                                            'Escribí la respuesta...'
                                        )}
                                        onChange={(e) =>
                                            setEditValues((v) => ({ ...v, answer: e.target.value }))
                                        }
                                    />
                                    <div className={styles.editActions}>
                                        <button
                                            type="button"
                                            className={styles.saveBtn}
                                            disabled={isBusy}
                                            onClick={() => handleEditSubmit(faq.id)}
                                        >
                                            {t('host.properties.editor.faq.saveButton', 'Guardar')}
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.cancelBtn}
                                            onClick={cancelEdit}
                                        >
                                            {t(
                                                'host.properties.editor.faq.cancelButton',
                                                'Cancelar'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ) : (
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
                                                'host.properties.editor.faq.moveUpAria',
                                                'Subir "{{question}}"',
                                                { question: snippet }
                                            )}
                                            disabled={index === 0 || isBusy}
                                            onClick={() => moveItem(index, 'up')}
                                        >
                                            <ChevronUpIcon
                                                size="sm"
                                                weight="bold"
                                                aria-hidden="true"
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.iconBtn}
                                            aria-label={t(
                                                'host.properties.editor.faq.moveDownAria',
                                                'Bajar "{{question}}"',
                                                { question: snippet }
                                            )}
                                            disabled={index === faqs.length - 1 || isBusy}
                                            onClick={() => moveItem(index, 'down')}
                                        >
                                            <ChevronDownIcon
                                                size="sm"
                                                weight="bold"
                                                aria-hidden="true"
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.editBtn}
                                            aria-label={t(
                                                'host.properties.editor.faq.editAria',
                                                'Editar "{{question}}"',
                                                { question: snippet }
                                            )}
                                            disabled={isBusy}
                                            onClick={() => startEdit(faq)}
                                        >
                                            <EditIcon
                                                size="sm"
                                                weight="regular"
                                                aria-hidden="true"
                                            />
                                            <span>
                                                {t(
                                                    'host.properties.editor.faq.editButton',
                                                    'Editar'
                                                )}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.deleteBtn}
                                            aria-label={t(
                                                'host.properties.editor.faq.deleteAria',
                                                'Eliminar "{{question}}"',
                                                { question: snippet }
                                            )}
                                            disabled={isBusy}
                                            onClick={() => handleDelete(faq)}
                                        >
                                            <DeleteIcon
                                                size="sm"
                                                weight="regular"
                                                aria-hidden="true"
                                            />
                                            <span>
                                                {t(
                                                    'host.properties.editor.faq.deleteButton',
                                                    'Eliminar'
                                                )}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ol>

            {isAdding ? (
                <div className={styles.addForm}>
                    <label
                        className={styles.fieldLabel}
                        htmlFor="faq-new-q"
                    >
                        {t('host.properties.editor.faq.questionLabel', 'Pregunta')}
                    </label>
                    <textarea
                        id="faq-new-q"
                        className={styles.textarea}
                        rows={2}
                        value={addValues.question}
                        placeholder={t(
                            'host.properties.editor.faq.questionPlaceholder',
                            'Escribí la pregunta...'
                        )}
                        onChange={(e) => setAddValues((v) => ({ ...v, question: e.target.value }))}
                    />
                    <label
                        className={styles.fieldLabel}
                        htmlFor="faq-new-a"
                    >
                        {t('host.properties.editor.faq.answerLabel', 'Respuesta')}
                    </label>
                    <textarea
                        id="faq-new-a"
                        className={styles.textarea}
                        rows={4}
                        value={addValues.answer}
                        placeholder={t(
                            'host.properties.editor.faq.answerPlaceholder',
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
                            {t('host.properties.editor.faq.saveButton', 'Guardar')}
                        </button>
                        <button
                            type="button"
                            className={styles.cancelBtn}
                            onClick={() => {
                                setIsAdding(false);
                                setAddValues(EMPTY_EDITOR);
                            }}
                        >
                            {t('host.properties.editor.faq.cancelButton', 'Cancelar')}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() => setIsAdding(true)}
                >
                    <AddIcon
                        size="sm"
                        weight="bold"
                        aria-hidden="true"
                    />
                    {t('host.properties.editor.faq.addButton', 'Agregar pregunta')}
                </button>
            )}
        </fieldset>
    );
}
