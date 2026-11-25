import { GradientButton } from '@/components/ui/GradientButtonReact';
import { useListingConversationAction } from '@/hooks/use-listing-conversation-action';
import type { SupportedLocale } from '@/lib/i18n';

/** Anonymous SSR contact anchor, upgraded to the visitor's thread after hydration. */
export function ConversationCta({
    accommodationId,
    locale
}: {
    readonly accommodationId: string;
    readonly locale: SupportedLocale;
}) {
    const action = useListingConversationAction({ accommodationId, locale });
    return (
        <GradientButton
            href={action.href}
            label={action.label}
            variant="accent"
            flat
            size="md"
            shape="rounded"
        />
    );
}
