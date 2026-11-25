import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

/** Resolve a contact CTA without putting visitor state in the cached page. */
export function resolveConversationAction({
    conversationId,
    locale,
    fallbackHref = '#contact'
}: {
    readonly conversationId: string | null;
    readonly locale: SupportedLocale;
    readonly fallbackHref?: string;
}) {
    const { t } = createTranslations(locale);
    return {
        hasConversation: Boolean(conversationId),
        label: t(
            conversationId
                ? 'conversations.actions.viewConversation'
                : 'accommodations.detail.pricing.consult'
        ),
        href: conversationId
            ? buildUrl({
                  locale,
                  path: `mi-cuenta/consultas/${encodeURIComponent(conversationId)}`
              })
            : fallbackHref
    };
}
