/**
 * StatusBadge component for conversation status display.
 *
 * Renders a Shadcn Badge with a color variant mapped to ConversationStatus.
 */

import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import type { ConversationStatus } from '../types';

/** Props for the StatusBadge component */
export interface StatusBadgeProps {
    /** The conversation status to display */
    status: ConversationStatus;
}

/** Map from ConversationStatus to Badge variant class names */
const STATUS_CLASSES: Record<ConversationStatus, string> = {
    PENDING_VERIFICATION: 'border-warning/30 bg-warning/15 text-warning',
    PENDING_OWNER: 'border-info/30 bg-info/15 text-info',
    PENDING_GUEST: 'bg-purple-100 text-purple-800 border-purple-200',
    OPEN: 'border-success/30 bg-success/15 text-success',
    CLOSED: 'bg-gray-100 text-gray-700 border-gray-200',
    BLOCKED: 'border-destructive/30 bg-destructive/15 text-destructive'
};

/** Map from ConversationStatus to i18n key */
const STATUS_I18N_KEYS: Record<ConversationStatus, TranslationKey> = {
    PENDING_VERIFICATION: 'conversations.status.pendingVerification',
    PENDING_OWNER: 'conversations.status.pendingOwner',
    PENDING_GUEST: 'conversations.status.pendingGuest',
    OPEN: 'conversations.status.open',
    CLOSED: 'conversations.status.closed',
    BLOCKED: 'conversations.status.blocked'
};

/**
 * Renders a colour-coded badge for a conversation status.
 *
 * @param props - StatusBadgeProps
 */
export function StatusBadge({ status }: StatusBadgeProps) {
    const { t } = useTranslations();

    return (
        <Badge
            variant="outline"
            className={STATUS_CLASSES[status]}
        >
            {t(STATUS_I18N_KEYS[status])}
        </Badge>
    );
}
