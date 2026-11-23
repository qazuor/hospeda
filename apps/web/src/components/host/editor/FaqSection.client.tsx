/**
 * @file FaqSection.client.tsx
 * @description Self-contained FAQ manager for the accommodation editor (HOS-393).
 *
 * Modeled on `ListingFaqManager.client.tsx` (SPEC-253) but styled as a card
 * of `src/components/host/editor/` (fieldset + legend, matching
 * the services page's catalog section), and wired against the accommodation-scoped
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
 * Accessibility: the reorder/edit/remove buttons are per-item and would
 * otherwise share an identical accessible name across every row. The
 * Repeater names its buttons after the row label (a snippet of the question)
 * and the edit button embeds the same snippet.
 *
 * HOS-794: submitting an invalid add/edit form marks the offending fields
 * (`faq-validation.ts` against the shared payload schema) instead of
 * returning silently.
 *
 * HOS-2490: the list chrome (visible row label, move up/down, remove with its
 * confirmation, add button, empty state) is the kit `Repeater`. The state and
 * requests live in `use-faq-section.ts`, the add/edit form in
 * `FaqEditorFields.client.tsx`.
 */

import { EditIcon, EyeOffIcon, SparkleIcon } from '@repo/icons';
import type { JSX } from 'react';
import { Repeater } from '@/components/account/ui/Repeater';
import type { AccommodationFaqItem } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { FaqEditorFields } from './FaqEditorFields.client';
import styles from './FaqSection.module.css';
import { hasNonDefaultChannelState, LABEL_SNIPPET_MAX, toLabelSnippet } from './faq-section-model';
import { PlanEntitlementGate } from './PlanEntitlementGate.client';
import { useFaqSection } from './use-faq-section';

// Re-export for consumers (the SSR page needs the type for `initialFaqs`).
export type { AccommodationFaqItem };

/** Props for FaqSection. */
export interface FaqSectionProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    /** Pre-fetched FAQs from the SSR editor page (may be empty). */
    readonly initialFaqs: readonly AccommodationFaqItem[];
}

/**
 * FaqSection
 *
 * Owner FAQ management UI for the accommodation editor — list, add, edit,
 * reorder and delete FAQs. Each action calls the accommodation FAQ endpoint
 * directly; nothing here flows through the parent editor's PATCH payload.
 *
 * @param props - See {@link FaqSectionProps}.
 * @returns The FAQ fieldset.
 */
export function FaqSection({ locale, accommodationId, initialFaqs }: FaqSectionProps): JSX.Element {
    const s = useFaqSection({ locale, accommodationId, initialFaqs });
    const { t } = s;
    // Any request in flight locks every row action: `busyId` is a single slot
    // shared by add, edit, remove and reorder, so a second action started
    // mid-flight would be cleared by whichever request settles first.
    const isAnyBusy = s.busyId !== null;

    const rowLabel = (faq: AccommodationFaqItem, index: number): string =>
        toLabelSnippet(faq.question) ||
        t('host.properties.editor.faq.rowFallback', undefined, { n: index + 1 });

    const prefillMessageId = s.prefillMessageId;
    const aiDraftExtras = (
        <>
            {prefillMessageId && (
                <PlanEntitlementGate
                    entitlementKey="ai_faq_draft"
                    locale={locale}
                    fallback={null}
                >
                    <button
                        className={styles.aiDraftButton}
                        type="button"
                        disabled={s.faqAiDraft.isLoading}
                        onClick={() =>
                            void s.faqAiDraft.suggest({
                                messageId: prefillMessageId,
                                onDraft: (draft) => {
                                    s.setAddValues((values) => ({ ...values, answer: draft }));
                                    s.setIsAiDraftContent(true);
                                }
                            })
                        }
                    >
                        {s.faqAiDraft.isLoading
                            ? t(
                                  'host.properties.editor.aiQuestions.aiDraftLoading',
                                  'Generando una sugerencia…'
                              )
                            : t(
                                  'host.properties.editor.aiQuestions.suggestAiAnswer',
                                  'Sugerir respuesta con IA'
                              )}
                    </button>
                    {s.isAiDraftContent && (
                        <p className={styles.aiDraftDisclaimer}>
                            {t(
                                'host.properties.editor.aiQuestions.aiDraftDisclaimer',
                                'Es un borrador editable. Revisá que coincida con la información de tu ficha antes de guardarlo.'
                            )}
                        </p>
                    )}
                    {s.faqAiDraft.feedback && s.faqAiDraft.feedback !== 'noData' && (
                        <p
                            className={styles.fieldError}
                            role="alert"
                        >
                            {t(
                                s.faqAiDraft.feedback === 'notEligible'
                                    ? 'host.properties.editor.aiQuestions.aiDraftNotEligible'
                                    : 'host.properties.editor.aiQuestions.aiDraftError',
                                'No se pudo generar la sugerencia. Intentá de nuevo.'
                            )}
                        </p>
                    )}
                </PlanEntitlementGate>
            )}
            {s.prefillMessageId &&
                (s.addValues.answer === '' || s.faqAiDraft.feedback === 'noData') && (
                    <p>
                        {t(
                            'host.properties.editor.aiQuestions.faqAnswerHelp',
                            'There is no confirmed answer. Fill it in using information from your listing.'
                        )}
                    </p>
                )}
        </>
    );

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.faqs', 'Preguntas frecuentes')}
            </legend>

            <div className={styles.channelIntro}>
                <p className={styles.channelIntroTitle}>
                    {t(
                        'host.properties.editor.faq.channelIntro.title',
                        '¿Por qué ocultar o restringir una pregunta?'
                    )}
                </p>
                <p className={styles.channelIntroBody}>
                    {t(
                        'host.properties.editor.faq.channelIntro.body1',
                        '"Visible en la ficha pública" muestra la pregunta en la página del alojamiento y en los datos estructurados (JSON-LD) que leen los buscadores. "Usable por la IA" permite que el asistente de chat use esta pregunta para responder consultas.'
                    )}
                </p>
                <p className={styles.channelIntroBody}>
                    {t(
                        'host.properties.editor.faq.channelIntro.body2',
                        'Destildá "Visible en la ficha pública" para información útil pero que no querés publicar: algo temporal ("la pileta está en refacción hasta noviembre"), un margen que preferís no prometer por escrito ("hay flexibilidad de late check-out si no hay reserva siguiente"), o una recomendación que suena mejor en una conversación que en la vidriera ("de noche conviene pedir remis").'
                    )}
                </p>
                <p className={styles.channelIntroBody}>
                    {t(
                        'host.properties.editor.faq.channelIntro.body3',
                        'Destildá "Usable por la IA" para contenido que preferís que se muestre tal cual, sin que el asistente lo parafrasee — texto legal o condiciones exactas de cancelación, por ejemplo.'
                    )}
                </p>
                <p className={styles.channelIntroNote}>
                    {t(
                        'host.properties.editor.faq.channelIntro.body4',
                        'Importante: una pregunta no visible en la ficha pero usable por la IA no es privada. El asistente se la puede decir a cualquiera que pregunte por chat; solo no aparece publicada en la página.'
                    )}
                </p>
            </div>

            {s.actionError && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {s.actionError}
                </p>
            )}

            <Repeater
                locale={locale}
                label={t('host.properties.editor.section.faqs', 'Preguntas frecuentes')}
                items={s.faqs}
                getKey={(faq) => faq.id}
                getItemLabel={rowLabel}
                disabled={isAnyBusy}
                canAdd={!s.isAdding}
                onAdd={s.startAdd}
                addLabel={t('host.properties.editor.faq.addButton', 'Agregar pregunta')}
                onMove={(index, delta) => void s.moveItem(index, delta)}
                onRemove={s.removeAt}
                getRemoveConfirm={(faq) => ({
                    title: t('host.properties.editor.faq.deleteDialogTitle', 'Eliminar pregunta'),
                    description: (
                        <>
                            {t(
                                'host.properties.editor.faq.deleteConfirm',
                                '¿Eliminás esta pregunta?'
                            )}
                            <br />
                            <strong>{faq.question}</strong>
                        </>
                    ),
                    confirmLabel: t(
                        'host.properties.editor.faq.deleteConfirmButton',
                        'Eliminar pregunta'
                    )
                })}
                empty={
                    s.isAdding
                        ? undefined
                        : {
                              title: t(
                                  'host.properties.editor.faq.emptyState',
                                  'Todavía no hay preguntas. Agregá la primera.'
                              )
                          }
                }
                renderItemActions={(faq) => (
                    <button
                        type="button"
                        className={styles.editBtn}
                        aria-label={t(
                            'host.properties.editor.faq.editAria',
                            'Editar "{{question}}"',
                            { question: toLabelSnippet(faq.question) }
                        )}
                        disabled={isAnyBusy}
                        onClick={() => s.startEdit(faq)}
                    >
                        <EditIcon
                            size="sm"
                            weight="regular"
                            aria-hidden="true"
                        />
                        <span>{t('host.properties.editor.faq.editButton', 'Editar')}</span>
                    </button>
                )}
                renderItem={(faq) =>
                    s.editingId === faq.id ? (
                        <FaqEditorFields
                            questionId={`faq-q-${faq.id}`}
                            answerId={`faq-a-${faq.id}`}
                            values={s.editValues}
                            errors={s.editFieldErrors}
                            t={t}
                            onValuesChange={s.setEditValues}
                            onErrorsChange={s.setEditFieldErrors}
                            onSubmit={() => void s.handleEditSubmit(faq.id)}
                            onCancel={s.cancelEdit}
                            isBusy={isAnyBusy}
                        />
                    ) : (
                        <div className={styles.itemContent}>
                            {faq.question.trim().length > LABEL_SNIPPET_MAX && (
                                <p className={styles.question}>{faq.question}</p>
                            )}
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
                                                'host.properties.editor.faq.notVisibleBadge',
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
                                                'host.properties.editor.faq.notAiUsableBadge',
                                                'No usable por IA'
                                            )}
                                        </span>
                                    )}
                                </div>
                            )}
                            <p className={styles.answer}>{faq.answer}</p>
                        </div>
                    )
                }
            />

            {s.isAdding && (
                <FaqEditorFields
                    questionId="faq-new-q"
                    answerId="faq-new-a"
                    values={s.addValues}
                    errors={s.addFieldErrors}
                    t={t}
                    onValuesChange={s.setAddValues}
                    onErrorsChange={s.setAddFieldErrors}
                    onSubmit={() => void s.handleAddSubmit()}
                    onCancel={s.cancelAdd}
                    isBusy={isAnyBusy}
                    answerExtras={aiDraftExtras}
                />
            )}
        </fieldset>
    );
}
