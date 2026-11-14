/**
 * AI conversation transcript (HOS-2075). Staff-only, read-only.
 *
 * Route: /ai/conversations/$id
 * Guard: AI_CONVERSATION_VIEW_ANY
 */

import { ArrowLeftIcon } from '@repo/icons';
import { createFileRoute, Link } from '@tanstack/react-router';
import { AiConversationTranscript } from '@/features/ai-conversations';
import { useTranslations } from '@/hooks/use-translations';
import { requireAiConversationsAccess } from '@/lib/ai-access';

export const Route = createFileRoute('/_authed/ai/conversations/$id')({
    beforeLoad: ({ context }) => requireAiConversationsAccess(context),
    component: AiConversationDetailPage
});

/** Transcript page with a back link to the list. */
export function AiConversationDetailPage() {
    const { t } = useTranslations();
    const { id } = Route.useParams();

    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <Link
                    to="/ai/conversations"
                    className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                    {t('admin-pages.ai.conversations.detail.back')}
                </Link>
                <h1 className="mt-2 font-semibold text-2xl tracking-tight">
                    {t('admin-pages.ai.conversations.detail.title')}
                </h1>
            </div>
            <AiConversationTranscript id={id} />
        </div>
    );
}
