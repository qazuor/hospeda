/**
 * ThreadView component.
 *
 * Renders messages from useConversation in ascending chronological order
 * (oldest at top, newest at bottom).
 * Cursor-based "load older" pattern: scroll-up button triggers a second query
 * with cursor < oldestLoadedTimestamp.
 * Auto-scrolls to bottom on first load and when new owner messages arrive.
 */

import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { useEffect, useRef, useState } from 'react';
import { useConversation } from '../hooks/useConversation';
import type { MessageWithSender } from '../types';
import { MessageBubble } from './MessageBubble';

/** Props for ThreadView */
export interface ThreadViewProps {
    /** Conversation ID to display */
    conversationId: string;
}

/**
 * Renders the full conversation thread with infinite scroll (load-older).
 *
 * @param props - ThreadViewProps
 */
export function ThreadView({ conversationId }: ThreadViewProps) {
    const { t } = useTranslations();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [olderCursor, setOlderCursor] = useState<string | undefined>(undefined);
    const [allMessages, setAllMessages] = useState<MessageWithSender[]>([]);
    const [hasScrolledInitially, setHasScrolledInitially] = useState(false);

    // Main thread query (most recent 50 messages)
    const mainQuery = useConversation({ id: conversationId });

    // Older-messages query (activated when user scrolls up)
    const olderQuery = useConversation({
        id: conversationId,
        cursor: olderCursor,
        enabled: Boolean(olderCursor)
    });

    // Merge older messages when the older query resolves
    useEffect(() => {
        if (olderQuery.data && olderCursor) {
            setAllMessages((prev) => {
                const newMessages = olderQuery.data.messages ?? [];
                // Prepend older messages, deduplicating by id
                const existingIds = new Set(prev.map((m) => m.id));
                const unique = newMessages.filter((m) => !existingIds.has(m.id));
                return [...unique, ...prev];
            });
        }
    }, [olderQuery.data, olderCursor]);

    // Initialize allMessages from main query on first load
    useEffect(() => {
        if (mainQuery.data && !hasScrolledInitially) {
            setAllMessages(mainQuery.data.messages ?? []);
        }
    }, [mainQuery.data, hasScrolledInitially]);

    // Auto-scroll to bottom on first load
    useEffect(() => {
        if (allMessages.length > 0 && !hasScrolledInitially && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            setHasScrolledInitially(true);
        }
    }, [allMessages, hasScrolledInitially]);

    // Auto-scroll to bottom when a new owner message appears
    useEffect(() => {
        if (!scrollRef.current || !hasScrolledInitially) return;
        const lastMsg = allMessages.at(-1);
        if (lastMsg?.senderType === 'OWNER') {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [allMessages, hasScrolledInitially]);

    const availableOlderCursor = mainQuery.data?.olderCursor;

    const handleLoadOlder = () => {
        if (availableOlderCursor) {
            setOlderCursor(availableOlderCursor);
        }
    };

    if (mainQuery.isLoading) {
        return (
            <div className="flex flex-col gap-3 p-4">
                {(['skel-0', 'skel-1', 'skel-2', 'skel-3'] as const).map((key, idx) => (
                    <div
                        key={key}
                        className={`h-12 w-3/4 animate-pulse rounded-lg bg-muted ${idx % 2 === 0 ? '' : 'self-end'}`}
                    />
                ))}
            </div>
        );
    }

    if (mainQuery.isError) {
        return (
            <div className="flex min-h-[200px] items-center justify-center">
                <p className="text-destructive text-sm">
                    {(mainQuery.error as Error)?.message ??
                        t('conversations.errors.conversationNotFound')}
                </p>
            </div>
        );
    }

    return (
        <div
            ref={scrollRef}
            className="flex flex-col gap-3 overflow-y-auto p-4"
            style={{ maxHeight: '60vh' }}
        >
            {/* Load older messages button */}
            {availableOlderCursor && (
                <div className="flex justify-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLoadOlder}
                        disabled={olderQuery.isFetching}
                    >
                        {olderQuery.isFetching
                            ? t('ui.loading.text')
                            : t('conversations.thread.older')}
                    </Button>
                </div>
            )}

            {/* Messages in ascending chronological order */}
            {allMessages.map((message) => (
                <MessageBubble
                    key={message.id}
                    message={message}
                />
            ))}

            {allMessages.length === 0 && (
                <p className="text-center text-muted-foreground text-sm">
                    {t('conversations.empty.ownerInbox')}
                </p>
            )}
        </div>
    );
}
