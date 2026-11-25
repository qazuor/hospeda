/** Accommodation FAQ controller. All mutations remain in useFaqSection. */
import { FaqEditor } from '@/components/account/editor/FaqEditor';
import { Button } from '@/components/account/ui/Button';
import type { AccommodationFaqItem } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { FaqEditorFields } from './FaqEditorFields.client';
import { toLabelSnippet } from './faq-section-model';
import { PlanEntitlementGate } from './PlanEntitlementGate.client';
import { useFaqSection } from './use-faq-section';

export type { AccommodationFaqItem };

/** SSR data and identity of the accommodation FAQ page. */
export interface FaqSectionProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly initialFaqs: readonly AccommodationFaqItem[];
}

/** Connects accommodation persistence and AI suggestions to shared presentation. */
export function FaqSection({ locale, accommodationId, initialFaqs }: FaqSectionProps) {
    const s = useFaqSection({ locale, accommodationId, initialFaqs });
    const { t } = s;
    const isAnyBusy = s.busyId !== null;
    const messageId = s.prefillMessageId;
    const answerExtras = (
        <>
            {messageId && (
                <PlanEntitlementGate
                    entitlementKey="ai_faq_draft"
                    locale={locale}
                    fallback={null}
                >
                    <Button
                        variant="secondary"
                        size="lg"
                        disabled={s.faqAiDraft.isLoading}
                        onClick={() =>
                            void s.faqAiDraft.suggest({
                                messageId,
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
                    </Button>
                    {s.isAiDraftContent && (
                        <p>{t('host.properties.editor.aiQuestions.aiDraftDisclaimer')}</p>
                    )}
                    {s.faqAiDraft.feedback && s.faqAiDraft.feedback !== 'noData' && (
                        <p role="alert">
                            {t(
                                s.faqAiDraft.feedback === 'notEligible'
                                    ? 'host.properties.editor.aiQuestions.aiDraftNotEligible'
                                    : 'host.properties.editor.aiQuestions.aiDraftError'
                            )}
                        </p>
                    )}
                </PlanEntitlementGate>
            )}
            {messageId && (s.addValues.answer === '' || s.faqAiDraft.feedback === 'noData') && (
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
        <FaqEditor
            locale={locale}
            vertical="accommodation"
            namespace="host.properties.editor.faq"
            t={t}
            items={s.faqs}
            disabled={isAnyBusy}
            isAdding={s.isAdding}
            editingId={s.editingId}
            error={s.actionError}
            rowLabel={(faq, index) =>
                toLabelSnippet(faq.question) ||
                t('host.properties.editor.faq.rowFallback', undefined, { n: index + 1 })
            }
            onAdd={s.startAdd}
            onEdit={s.startEdit}
            onMove={(index, delta) => void s.moveItem(index, delta)}
            onRemove={s.removeAt}
            renderEdit={(faq) => (
                <FaqEditorFields
                    locale={locale}
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
            )}
            addForm={
                <FaqEditorFields
                    locale={locale}
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
                    answerExtras={answerExtras}
                />
            }
        />
    );
}
