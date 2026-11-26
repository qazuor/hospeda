/** Shared owner FAQ controller; mutations persist immediately through a typed port. */
import { useMemo } from 'react';
import {
    createAccommodationFaqAdapter,
    createListingFaqAdapter,
    type FaqPersistence
} from '@/lib/api/faq-persistence';
import type { SupportedLocale } from '@/lib/i18n';
import { FaqAiDraft } from './FaqAiDraft.client';
import { FaqEditor } from './FaqEditor';
import { FaqEditorFields } from './FaqEditorFields.client';
import { type FaqConfig, type ListingFaq, toLabelSnippet } from './faq-model';
import { useFaqSection } from './use-faq-section';

/** Serializable identity/config plus an optional injected persistence port. */
export interface FaqSectionProps extends FaqConfig {
    readonly locale: SupportedLocale;
    readonly vertical: 'accommodation' | 'venue' | 'experience';
    readonly listingId: string;
    readonly initialFaqs: readonly ListingFaq[];
    readonly persistence?: FaqPersistence;
}

/** Connects one state machine to the common fields, AI block and kit surface. */
export function FaqSection(props: FaqSectionProps) {
    const {
        locale,
        vertical,
        listingId,
        initialFaqs,
        namespace,
        showCategory,
        errorSurface,
        validationMode
    } = props;
    // Astro islands receive serializable configuration; the browser binds the port.
    const persistence = useMemo(
        () =>
            props.persistence ??
            (vertical === 'accommodation'
                ? createAccommodationFaqAdapter({ accommodationId: listingId })
                : createListingFaqAdapter({ vertical, listingId })),
        [props.persistence, vertical, listingId]
    );
    const config = { namespace, showCategory, errorSurface, validationMode };
    const s = useFaqSection({ locale, initialFaqs, persistence, ...config });
    const { t } = s;
    const disabled = s.busyId !== null;
    const answerExtras = s.prefillMessageId ? (
        <>
            <FaqAiDraft
                locale={locale}
                vertical={vertical}
                messageId={s.prefillMessageId}
                faqAiDraft={s.faqAiDraft}
                isAiDraftContent={s.isAiDraftContent}
                onDraft={(draft) => {
                    s.setAddValues((values) => ({ ...values, answer: draft }));
                    s.setIsAiDraftContent(true);
                }}
                t={t}
            />
            {(s.addValues.answer === '' || s.faqAiDraft.feedback === 'noData') && (
                <p>
                    {t(
                        'host.properties.editor.aiQuestions.faqAnswerHelp',
                        'There is no confirmed answer. Fill it in using information from your listing.'
                    )}
                </p>
            )}
        </>
    ) : null;
    return (
        <FaqEditor
            locale={locale}
            vertical={vertical}
            namespace={namespace}
            t={t}
            items={s.faqs}
            disabled={disabled}
            isAdding={s.isAdding}
            editingId={s.editingId}
            error={s.actionError}
            rowLabel={(faq, index) =>
                vertical === 'accommodation'
                    ? toLabelSnippet({ question: faq.question }) ||
                      t(`${namespace}.rowFallback`, undefined, { n: index + 1 })
                    : faq.question
            }
            summary={
                vertical === 'accommodation'
                    ? undefined
                    : t(
                          `${namespace}.channelIntro.summary`,
                          'Elegí si cada pregunta se ve en la ficha y si el asistente de chat puede usarla.'
                      )
            }
            onAdd={s.startAdd}
            onEdit={s.startEdit}
            onMove={(index, delta) => void s.moveItem(index, delta)}
            onRemove={s.removeAt}
            renderEdit={(faq) => (
                <FaqEditorFields
                    {...config}
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
                    isBusy={disabled}
                />
            )}
            addForm={
                <FaqEditorFields
                    {...config}
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
                    isBusy={disabled}
                    answerExtras={answerExtras}
                />
            }
        />
    );
}
