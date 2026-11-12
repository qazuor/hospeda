import { useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { buildLimitReachedPayloadFromDetails } from '@/lib/billing-limit-error';
import type { SupportedLocale } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';

/** State exposed by {@link useFaqAiDraft}. */
export interface FaqAiDraftState {
    readonly isLoading: boolean;
    readonly feedback: 'noData' | 'error' | 'notEligible' | null;
    readonly suggest: (input: {
        readonly messageId: string;
        readonly onDraft: (draft: string) => void;
    }) => Promise<void>;
}

/** Calls the protected FAQ draft endpoint and maps quota/error states for both editors. */
export function useFaqAiDraft(input: { readonly locale: SupportedLocale }): FaqAiDraftState {
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState<FaqAiDraftState['feedback']>(null);
    const suggest: FaqAiDraftState['suggest'] = async ({ messageId, onDraft }) => {
        setIsLoading(true);
        setFeedback(null);
        try {
            const result = await apiClient.postProtected<{
                readonly hasData: boolean;
                readonly draft: string | null;
            }>({ path: `/api/v1/protected/ai/listing-questions/${messageId}/faq-draft` });
            if (!result.ok) {
                if (result.error.status === 409) setFeedback('notEligible');
                else if (result.error.status === 403 && result.error.code === 'LIMIT_REACHED') {
                    const toast = buildLimitReachedPayloadFromDetails({
                        details: result.error.details,
                        locale: input.locale
                    });
                    addToast({ type: 'error', message: toast.title, action: toast.action });
                } else setFeedback('error');
                return;
            }
            if (!result.data.hasData || result.data.draft === null) setFeedback('noData');
            else onDraft(result.data.draft);
        } catch {
            setFeedback('error');
        } finally {
            setIsLoading(false);
        }
    };
    return { isLoading, feedback, suggest };
}
