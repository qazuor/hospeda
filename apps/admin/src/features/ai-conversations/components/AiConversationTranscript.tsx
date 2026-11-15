/**
 * Read-only chat transcript of one listing AI conversation (HOS-2075). Turns
 * are rendered in the order the API returns them (chronological). Text is
 * already redacted by the API; nothing identifying the author exists.
 *
 * @module features/ai-conversations/components/AiConversationTranscript
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AiUsageBlockState } from '@/features/ai-usage/components/AiUsageBlockState';
import { useTranslations } from '@/hooks/use-translations';
import { formatDateWithTime } from '@/lib/format-helpers';
import { useAiConversationQuery } from '../hooks';

/** Props for {@link AiConversationTranscript}. */
export interface AiConversationTranscriptProps {
    /** Conversation UUID. */
    readonly id: string;
}

/**
 * Fetches and renders a conversation transcript (user vs assistant bubbles).
 */
export function AiConversationTranscript({ id }: AiConversationTranscriptProps) {
    const { t } = useTranslations();
    const { data, isLoading, isError } = useAiConversationQuery(id);

    if (isLoading) {
        return (
            <AiUsageBlockState
                status="loading"
                title={t('admin-pages.ai.conversations.loading')}
            />
        );
    }
    if (isError || !data) {
        return (
            <AiUsageBlockState
                status="error"
                title={t('admin-pages.ai.conversations.detail.loadError')}
            />
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin-pages.ai.conversations.detail.title')}</CardTitle>
                <CardDescription>
                    {t(
                        `admin-pages.ai.conversations.verticals.${data.entityType}` as 'admin-pages.ai.conversations.verticals.accommodation'
                    )}{' '}
                    <span className="font-mono text-xs">{data.entityId}</span>
                    {' · '}
                    {formatDateWithTime({ date: data.startedAt })}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {data.turns.length === 0 ? (
                    <AiUsageBlockState
                        status="empty"
                        title={t('admin-pages.ai.conversations.detail.noTurns')}
                    />
                ) : (
                    <ol
                        className="flex flex-col gap-3"
                        aria-label={t('admin-pages.ai.conversations.detail.title')}
                    >
                        {data.turns.map((turn) => {
                            const isUser = turn.role === 'user';
                            return (
                                <li
                                    key={turn.id}
                                    data-role={turn.role}
                                    className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                                            isUser
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted text-foreground'
                                        }`}
                                    >
                                        {turn.content}
                                    </div>
                                    <span className="text-muted-foreground text-xs">
                                        {t(
                                            `admin-pages.ai.conversations.detail.role.${turn.role}` as 'admin-pages.ai.conversations.detail.role.user'
                                        )}
                                        {' · '}
                                        {formatDateWithTime({ date: turn.createdAt })}
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </CardContent>
        </Card>
    );
}
