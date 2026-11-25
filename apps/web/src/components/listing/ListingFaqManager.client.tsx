/** Listing FAQ controller. Keeps immediate CRUD separate from the editor PATCH. */
import { FaqEditor } from '@/components/account/editor/FaqEditor';
import type { SupportedLocale } from '@/lib/i18n';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';
import { ListingFaqAiDraft } from './ListingFaqAiDraft.client';
import { ListingFaqEditorFields } from './ListingFaqEditorFields.client';
import type { ListingFaq } from './listing-faq-helpers';
import { useListingFaqManager } from './use-listing-faq-manager';

export type { ListingFaq } from './listing-faq-helpers';

/** Listing identity and preloaded FAQ rows. */
export interface ListingFaqManagerProps {
    readonly vertical: VenueOrExperience;
    readonly listingId: string;
    readonly locale: SupportedLocale;
    readonly initialFaqs: readonly ListingFaq[];
}

/** Supplies listing state, forms and handlers to the one shared FAQ editor. */
export function ListingFaqManager(props: ListingFaqManagerProps) {
    const { vertical, locale } = props;
    const s = useListingFaqManager(props);
    const { t } = s;
    const disabled = s.busyId !== null;
    return (
        <FaqEditor
            locale={locale}
            vertical={vertical}
            namespace="listing.owner.editor.faqManager"
            t={t}
            items={s.faqs}
            disabled={disabled}
            isAdding={s.isAdding}
            editingId={s.editingId}
            error={s.actionError}
            rowLabel={(faq) => faq.question}
            summary={t(
                'listing.owner.editor.faqManager.channelIntro.summary',
                'Elegí si cada pregunta se ve en la ficha y si el asistente de chat puede usarla.'
            )}
            onAdd={s.startAdd}
            onEdit={s.startEdit}
            onMove={(index, delta) => void s.moveAt(index, delta)}
            onRemove={s.removeAt}
            renderEdit={(faq) => (
                <ListingFaqEditorFields
                    locale={locale}
                    questionId={`faq-q-${faq.id}`}
                    answerId={`faq-a-${faq.id}`}
                    values={s.editValues}
                    errors={s.editErrors}
                    onChange={(patch) => s.setEditValues((values) => ({ ...values, ...patch }))}
                    isBusy={disabled}
                    onSave={() => void s.submitEdit(faq.id)}
                    onCancel={s.cancelEdit}
                    t={t}
                />
            )}
            addForm={
                <ListingFaqEditorFields
                    locale={locale}
                    questionId="faq-new-q"
                    answerId="faq-new-a"
                    values={s.addValues}
                    errors={s.addErrors}
                    onChange={(patch) => s.setAddValues((values) => ({ ...values, ...patch }))}
                    isBusy={disabled}
                    onSave={() => void s.submitAdd()}
                    onCancel={s.cancelAdd}
                    t={t}
                    answerExtra={
                        s.prefillMessageId ? (
                            <>
                                <ListingFaqAiDraft
                                    locale={locale}
                                    vertical={vertical}
                                    messageId={s.prefillMessageId}
                                    faqAiDraft={s.faqAiDraft}
                                    isAiDraftContent={s.isAiDraftContent}
                                    onDraft={s.applyAiDraft}
                                    t={t}
                                />
                                {(s.addValues.answer === '' ||
                                    s.faqAiDraft.feedback === 'noData') && (
                                    <p>
                                        {t(
                                            'host.properties.editor.aiQuestions.faqAnswerHelp',
                                            'There is no confirmed answer. Fill it in using information from your listing.'
                                        )}
                                    </p>
                                )}
                            </>
                        ) : null
                    }
                />
            }
        />
    );
}
