import { GradientButton } from '@/components/ui/GradientButtonReact';
import { useListingConversationAction } from '@/hooks/use-listing-conversation-action';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';

/** Anonymous SSR contact anchor, upgraded to the visitor's thread after hydration. */
export function ConversationCta({
    accommodationId,
    locale,
    labelKey
}: {
    readonly accommodationId: string;
    readonly locale: SupportedLocale;
    readonly labelKey?: string;
}) {
    const action = useListingConversationAction({ accommodationId, locale });
    const { t } = createTranslations(locale);
    return (
        <GradientButton
            href={action.href}
            label={!action.hasConversation && labelKey ? t(labelKey) : action.label}
            variant="accent"
            flat
            size="md"
            shape="rounded"
        />
    );
}
