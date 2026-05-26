/**
 * MessageBubble component for rendering a single conversation message.
 *
 * Renders sender label, plain-text body with safe URL autolinking,
 * timestamp, and read receipt for owner messages.
 *
 * Security: NO setInnerHTML is used. URLs are rendered as React anchor elements
 * with rel="noopener noreferrer". Only http/https links are linkified.
 */

import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import type { MessageWithSender } from '../types';
import { formatAbsoluteTime, formatRelativeTime, parseTextSegments } from '../utils';

/** Props for the MessageBubble component */
export interface MessageBubbleProps {
    /** The message data to render */
    message: MessageWithSender;
}

/**
 * Renders a single message bubble with sender info, body, and metadata.
 *
 * @param props - MessageBubbleProps
 */
export function MessageBubble({ message }: MessageBubbleProps) {
    const { t } = useTranslations();

    const isOwner = message.senderType === 'OWNER';
    const isSystem = message.senderType === 'SYSTEM';
    const segments = parseTextSegments(message.body);

    const senderLabel = isSystem
        ? t('conversations.thread.systemMessage')
        : isOwner
          ? t('conversations.senderLabels.owner')
          : t('conversations.senderLabels.guest');

    return (
        <div
            className={cn(
                'flex max-w-[80%] flex-col gap-1',
                isOwner ? 'items-end self-end' : 'items-start self-start',
                isSystem && 'max-w-full items-center self-center opacity-70'
            )}
        >
            {/* Sender label */}
            <span className="font-medium text-muted-foreground text-xs">{senderLabel}</span>

            {/* Message body bubble — no innerHTML, segments rendered as React elements */}
            <div
                className={cn(
                    'whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm',
                    isOwner && 'bg-primary text-primary-foreground',
                    !isOwner && !isSystem && 'bg-muted text-foreground',
                    isSystem &&
                        'rounded border border-border bg-transparent px-2 py-1 text-muted-foreground text-xs italic'
                )}
            >
                {segments.map((seg, idx) =>
                    seg.type === 'link' ? (
                        <a
                            key={`${seg.type}-${idx}-${seg.href}`}
                            href={seg.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:opacity-80"
                        >
                            {seg.value}
                        </a>
                    ) : (
                        <span key={`${seg.type}-${idx}-${seg.value.slice(0, 16)}`}>
                            {seg.value}
                        </span>
                    )
                )}
            </div>

            {/* Timestamp and read receipt */}
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <time
                    dateTime={message.createdAt}
                    title={formatAbsoluteTime(message.createdAt)}
                >
                    {formatRelativeTime(message.createdAt)}
                </time>

                {/* Read receipt for owner messages */}
                {isOwner && message.readAtByGuest && (
                    <span className="text-success">{t('conversations.thread.readByGuest')}</span>
                )}
            </div>
        </div>
    );
}
