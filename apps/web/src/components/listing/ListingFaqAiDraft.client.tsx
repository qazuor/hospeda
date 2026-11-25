/**
 * The «Sugerir respuesta con IA» block of the add form (HOS-2101).
 *
 * Only mounted when the add form was opened from an AI-assistant question
 * (`prefillMessageId`). The suggestion is a draft the owner reviews, never
 * saved on its own; the whole block sits behind the `ai_faq_draft` plan
 * entitlement.
 *
 * @module components/listing/ListingFaqAiDraft.client
 */

import type { JSX } from 'react';
import styles from '@/components/account/editor/FaqEditor.module.css';
import { Button } from '@/components/account/ui/Button';
import { PlanEntitlementGate } from '@/components/host/editor/PlanEntitlementGate.client';
import type { FaqAiDraftState } from '@/hooks/use-faq-ai-draft';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';

/** Props of {@link ListingFaqAiDraft}. */
export interface ListingFaqAiDraftProps {
    readonly locale: SupportedLocale;
    readonly vertical: VenueOrExperience;
    /** The assistant message the question came from. */
    readonly messageId: string;
    readonly faqAiDraft: FaqAiDraftState;
    /** Whether the answer currently holds an AI draft (shows the notice). */
    readonly isAiDraftContent: boolean;
    /** Receives the suggested answer. */
    readonly onDraft: (draft: string) => void;
    readonly t: TranslationFn;
}

/**
 * The plan-gated AI suggestion button, its disclaimer and its feedback.
 *
 * @param props - See {@link ListingFaqAiDraftProps}.
 * @returns The gated block.
 */
export function ListingFaqAiDraft({
    locale,
    vertical,
    messageId,
    faqAiDraft,
    isAiDraftContent,
    onDraft,
    t
}: ListingFaqAiDraftProps): JSX.Element {
    return (
        <PlanEntitlementGate
            entitlementKey="ai_faq_draft"
            locale={locale}
            vertical={vertical}
            fallback={null}
        >
            <div className={styles.stack}>
                <Button
                    variant="secondary"
                    size="lg"
                    disabled={faqAiDraft.isLoading}
                    onClick={() => void faqAiDraft.suggest({ messageId, onDraft })}
                >
                    {faqAiDraft.isLoading
                        ? t(
                              'host.properties.editor.aiQuestions.aiDraftLoading',
                              'Generando una sugerencia…'
                          )
                        : t(
                              'host.properties.editor.aiQuestions.suggestAiAnswer',
                              'Sugerir respuesta con IA'
                          )}
                </Button>
                {isAiDraftContent && (
                    <p>
                        {t(
                            'host.properties.editor.aiQuestions.aiDraftDisclaimer',
                            'Es un borrador editable. Revisá que coincida con la información de tu ficha antes de guardarlo.'
                        )}
                    </p>
                )}
                {faqAiDraft.feedback && faqAiDraft.feedback !== 'noData' && (
                    <p role="alert">
                        {t(
                            faqAiDraft.feedback === 'notEligible'
                                ? 'host.properties.editor.aiQuestions.aiDraftNotEligible'
                                : 'host.properties.editor.aiQuestions.aiDraftError',
                            faqAiDraft.feedback === 'notEligible'
                                ? 'Esta pregunta ya tiene una respuesta del asistente.'
                                : 'No se pudo generar la sugerencia. Intentá de nuevo.'
                        )}
                    </p>
                )}
            </div>
        </PlanEntitlementGate>
    );
}
