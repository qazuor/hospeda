/**
 * ArchiveToggle component.
 *
 * Single button that toggles the archivedByOwner flag via useArchiveMutation.
 */

import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { useArchiveMutation } from '../hooks/useArchiveMutation';

/** Props for ArchiveToggle */
export interface ArchiveToggleProps {
    /** Conversation ID to archive/unarchive */
    conversationId: string;
    /** Current archive state */
    isArchived: boolean;
}

/**
 * Renders an archive/unarchive button for a conversation.
 *
 * @param props - ArchiveToggleProps
 */
export function ArchiveToggle({ conversationId, isArchived }: ArchiveToggleProps) {
    const { t } = useTranslations();
    const mutation = useArchiveMutation();

    const handleClick = () => {
        mutation.mutate({ conversationId, archived: !isArchived });
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleClick}
            disabled={mutation.isPending}
        >
            {isArchived ? t('conversations.actions.unarchive') : t('conversations.actions.archive')}
        </Button>
    );
}
