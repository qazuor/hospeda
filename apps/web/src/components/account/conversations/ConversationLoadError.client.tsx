/**
 * @file ConversationLoadError.client.tsx
 * @description The transient-failure state of a conversation thread page, in
 * both inboxes (HOS-2481 / HOS-2482): the kit `ErrorState` with a retry that
 * reloads the page. Only a real «not found» (404) becomes the in-layout
 * not-found page (HOS-2434); a network or server failure is never presented as
 * a missing conversation.
 */

import { ErrorState, type HelpAnchor } from '@/components/account/ui';
import { createT, type SupportedLocale } from '@/lib/i18n';

/** Props of {@link ConversationLoadError}. */
export interface ConversationLoadErrorProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** Help anchor of the thread section. */
    readonly helpId?: HelpAnchor;
}

/**
 * Renders the retryable error block.
 *
 * @param props - See {@link ConversationLoadErrorProps}.
 * @returns The error state.
 */
export function ConversationLoadError({ locale, helpId }: ConversationLoadErrorProps) {
    const t = createT(locale);
    return (
        <ErrorState
            locale={locale}
            onRetry={() => window.location.reload()}
            title={t('conversations.thread.loadError.title')}
            description={t('conversations.thread.loadError.body')}
            helpId={helpId}
        />
    );
}
