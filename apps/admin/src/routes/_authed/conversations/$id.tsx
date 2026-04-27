/**
 * Conversation thread detail page.
 *
 * Route: /conversations/$id
 * Renders ThreadView + ReplyForm + action buttons (Close, Reopen, Block, Archive).
 * DeleteDialog shown only when actor has CONVERSATION_DELETE_ANY.
 */

import { Button } from '@/components/ui/button';
import { ArchiveToggle } from '@/features/conversations/components/ArchiveToggle';
import { BlockDialog } from '@/features/conversations/components/BlockDialog';
import { DeleteDialog } from '@/features/conversations/components/DeleteDialog';
import { ReplyForm } from '@/features/conversations/components/ReplyForm';
import { StatusBadge } from '@/features/conversations/components/StatusBadge';
import { ThreadView } from '@/features/conversations/components/ThreadView';
import { useConversation } from '@/features/conversations/hooks/useConversation';
import { useUpdateStatusMutation } from '@/features/conversations/hooks/useUpdateStatusMutation';
import { useTranslations } from '@/hooks/use-translations';
import { useHasAnyPermission, useHasPermission } from '@/hooks/use-user-permissions';
import { PermissionEnum } from '@repo/schemas';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/conversations/$id')({
    component: ConversationDetailPage
});

/**
 * Conversation thread detail page component.
 */
function ConversationDetailPage() {
    const { t } = useTranslations();
    const { id } = Route.useParams();
    const navigate = useNavigate();
    const statusMutation = useUpdateStatusMutation();

    const { data: conversation, isLoading, isError } = useConversation({ id });

    const canReplyOwn = useHasPermission(PermissionEnum.CONVERSATION_REPLY_OWN);
    const canReplyAny = useHasPermission(PermissionEnum.CONVERSATION_REPLY_ANY);
    const canReply = canReplyOwn || canReplyAny;

    const canUpdateStatusOwn = useHasPermission(PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN);
    const canUpdateStatusAny = useHasPermission(PermissionEnum.CONVERSATION_UPDATE_STATUS_ANY);
    const canUpdateStatus = canUpdateStatusOwn || canUpdateStatusAny;

    const canBlock = useHasAnyPermission([
        PermissionEnum.CONVERSATION_BLOCK_OWN,
        PermissionEnum.CONVERSATION_BLOCK_ANY
    ]);

    const handleClose = () => {
        statusMutation.mutate({ conversationId: id, status: 'CLOSED' });
    };

    const handleReopen = () => {
        statusMutation.mutate({ conversationId: id, status: 'OPEN' });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4">
                <div className="h-8 w-64 animate-pulse rounded bg-muted" />
                <div className="h-[400px] animate-pulse rounded-lg bg-muted" />
            </div>
        );
    }

    if (isError || !conversation) {
        return (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-4">
                <p className="text-muted-foreground">
                    {t('conversations.errors.conversationNotFound')}
                </p>
                <Link
                    to="/conversations"
                    className="text-primary text-sm underline"
                >
                    {t('conversations.inbox.title')}
                </Link>
            </div>
        );
    }

    const guestName =
        conversation.guest.name ?? conversation.guest.anonName ?? conversation.guest.email ?? '—';

    const isBlocked = conversation.status === 'BLOCKED';
    const isClosed = conversation.status === 'CLOSED';

    return (
        <div className="flex flex-col gap-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Link
                    to="/conversations"
                    className="hover:text-foreground"
                >
                    {t('conversations.inbox.title')}
                </Link>
                <span>/</span>
                <span className="text-foreground">{guestName}</span>
            </div>

            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="font-bold text-2xl">
                        {t('conversations.thread.title', { senderName: guestName })}
                    </h1>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <span>{conversation.accommodation.name}</span>
                        <StatusBadge status={conversation.status} />
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Archive toggle */}
                    <ArchiveToggle
                        conversationId={id}
                        isArchived={conversation.archivedByOwner}
                    />

                    {/* Close / Reopen */}
                    {canUpdateStatus &&
                        !isBlocked &&
                        (isClosed ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleReopen}
                                disabled={statusMutation.isPending}
                            >
                                {t('conversations.actions.reopen')}
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleClose}
                                disabled={statusMutation.isPending}
                            >
                                {t('conversations.actions.close')}
                            </Button>
                        ))}

                    {/* Block dialog — only when not already blocked */}
                    {canBlock && !isBlocked && <BlockDialog conversationId={id} />}

                    {/* Delete dialog — gated by CONVERSATION_DELETE_ANY in the component itself */}
                    <DeleteDialog
                        conversationId={id}
                        onSuccess={() => navigate({ to: '/conversations' })}
                    />
                </div>
            </div>

            {/* Thread view */}
            <div className="rounded-lg border bg-card">
                <ThreadView conversationId={id} />
            </div>

            {/* Reply form */}
            {canReply && (
                <div className="rounded-lg border bg-card p-4">
                    <ReplyForm
                        conversationId={id}
                        status={conversation.status}
                    />
                </div>
            )}
        </div>
    );
}
