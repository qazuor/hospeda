import type { SupportedLocale } from '@/lib/i18n';
import { resolveConversationAction } from '@/lib/listing-contact/conversation-action';
import { useAccommodationConversation } from '@/store/accommodation-conversation-store';

/** Share the conversation lookup and CTA resolution across listing surfaces. */
export function useListingConversationAction({
    accommodationId,
    locale,
    fallbackHref
}: {
    readonly accommodationId?: string;
    readonly locale: SupportedLocale;
    readonly fallbackHref?: string;
}) {
    const { conversationId } = useAccommodationConversation({
        accommodationId: accommodationId ?? '',
        enabled: Boolean(accommodationId)
    });
    return resolveConversationAction({
        conversationId: accommodationId ? conversationId : null,
        locale,
        fallbackHref
    });
}
