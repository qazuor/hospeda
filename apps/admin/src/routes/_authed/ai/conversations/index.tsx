/**
 * AI conversations list (HOS-2075). Staff-only, read-only.
 *
 * Route: /ai/conversations
 * Guard: AI_CONVERSATION_VIEW_ANY
 */

import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import {
    AI_CONVERSATIONS_DEFAULT_PAGE_SIZE,
    AiConversationsFilters,
    type AiConversationsSearch,
    AiConversationsSearchSchema,
    AiConversationsTable
} from '@/features/ai-conversations';
import { useTranslations } from '@/hooks/use-translations';
import { requireAiConversationsAccess } from '@/lib/ai-access';

export const Route = createFileRoute('/_authed/ai/conversations/')({
    beforeLoad: ({ context }) => requireAiConversationsAccess(context),
    validateSearch: AiConversationsSearchSchema,
    component: AiConversationsPage
});

/** Conversations list page: filters in the URL, table below. */
export function AiConversationsPage() {
    const { t } = useTranslations();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();

    const patch = (next: Partial<AiConversationsSearch>) => {
        void navigate({ search: (prev: AiConversationsSearch) => ({ ...prev, ...next, page: 1 }) });
    };

    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-2xl tracking-tight">
                    {t('admin-pages.ai.conversations.title')}
                </h1>
                <p className="mt-1 text-muted-foreground text-sm">
                    {t('admin-pages.ai.conversations.subtitle')}
                </p>
            </div>
            <Card>
                <CardContent className="pt-6">
                    <AiConversationsFilters
                        search={search}
                        onChange={patch}
                        onReset={() =>
                            void navigate({
                                search: { page: 1, pageSize: AI_CONVERSATIONS_DEFAULT_PAGE_SIZE }
                            })
                        }
                    />
                </CardContent>
            </Card>
            <AiConversationsTable
                search={search}
                onPageChange={(page) =>
                    void navigate({ search: (prev: AiConversationsSearch) => ({ ...prev, page }) })
                }
            />
        </div>
    );
}
