/**
 * Conversations inbox page.
 *
 * Route: /conversations
 * Lists all conversations for the current owner (or all if CONVERSATION_VIEW_ALL).
 * Pagination and filter state live in URL search params.
 *
 * beforeLoad: requires CONVERSATION_VIEW_OWN or CONVERSATION_VIEW_ALL.
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { InboxList } from '@/features/conversations/components/InboxList';
import { useConversations } from '@/features/conversations/hooks/useConversations';
import type { ConversationListFilters, ConversationStatus } from '@/features/conversations/types';
import { useTranslations } from '@/hooks/use-translations';
import type { AuthState } from '@/lib/auth-session';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

const searchSchema = z.object({
    page: z.coerce.number().int().positive().default(1).catch(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20).catch(20),
    status: z
        .enum([
            'PENDING_VERIFICATION',
            'PENDING_OWNER',
            'PENDING_GUEST',
            'OPEN',
            'CLOSED',
            'BLOCKED'
        ])
        .optional()
        .catch(undefined),
    guestEmail: z.string().optional().catch(undefined),
    accommodationId: z.string().optional().catch(undefined)
});

export const Route = createFileRoute('/_authed/conversations/')({
    validateSearch: searchSchema,
    beforeLoad: ({ context }) => {
        // TYPE-WORKAROUND: TanStack Router context type can't infer dynamically-loaded auth fields populated in the parent beforeLoad; cast restores the AuthState shape set there.
        const authState = context as unknown as AuthState;

        const hasViewPermission =
            authState.permissions?.includes(PermissionEnum.CONVERSATION_VIEW_OWN) ||
            authState.permissions?.includes(PermissionEnum.CONVERSATION_VIEW_ALL);

        if (!hasViewPermission) {
            throw redirect({ to: '/auth/forbidden' });
        }
    },
    component: ConversationsIndexPage
});

/**
 * Conversations inbox page component.
 */
function ConversationsIndexPage() {
    const { t } = useTranslations();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();

    const filters: ConversationListFilters = {
        page: search.page,
        pageSize: search.pageSize,
        status: search.status,
        guestEmail: search.guestEmail,
        accommodationId: search.accommodationId
    };

    const { data, isLoading } = useConversations(filters);

    const items = data?.items ?? [];
    const total = data?.pagination.total ?? 0;

    const handlePageChange = (page: number) => {
        navigate({ search: (prev) => ({ ...prev, page }) });
    };

    const handleStatusChange = (value: string) => {
        navigate({
            search: (prev) => ({
                ...prev,
                status: value === '__all__' ? undefined : (value as ConversationStatus),
                page: 1
            })
        });
    };

    const handleGuestEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value || undefined;
        navigate({ search: (prev) => ({ ...prev, guestEmail: value, page: 1 }) });
    };

    const handleClearFilters = () => {
        navigate({
            search: { page: 1, pageSize: search.pageSize }
        });
    };

    const hasActiveFilters = Boolean(search.status || search.guestEmail || search.accommodationId);

    return (
        <div className="flex flex-col gap-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <h1 className="font-bold text-2xl tracking-tight">
                    {t('conversations.inbox.ownerInboxTitle')}
                </h1>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-end gap-3">
                {/* Status filter */}
                <div className="flex flex-col gap-1">
                    <label
                        htmlFor="conversations-filter-status"
                        className="font-medium text-muted-foreground text-xs"
                    >
                        {t('conversations.filters.status')}
                    </label>
                    <Select
                        value={search.status ?? '__all__'}
                        onValueChange={handleStatusChange}
                    >
                        <SelectTrigger
                            id="conversations-filter-status"
                            className="w-[180px]"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">
                                {t('conversations.filters.all')}
                            </SelectItem>
                            <SelectItem value="PENDING_OWNER">
                                {t('conversations.status.pendingOwner')}
                            </SelectItem>
                            <SelectItem value="PENDING_GUEST">
                                {t('conversations.status.pendingGuest')}
                            </SelectItem>
                            <SelectItem value="OPEN">{t('conversations.status.open')}</SelectItem>
                            <SelectItem value="CLOSED">
                                {t('conversations.status.closed')}
                            </SelectItem>
                            <SelectItem value="BLOCKED">
                                {t('conversations.status.blocked')}
                            </SelectItem>
                            <SelectItem value="PENDING_VERIFICATION">
                                {t('conversations.status.pendingVerification')}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Guest email filter */}
                <div className="flex flex-col gap-1">
                    <label
                        htmlFor="conversations-filter-guest-email"
                        className="font-medium text-muted-foreground text-xs"
                    >
                        {t('conversations.filters.guestEmail')}
                    </label>
                    <Input
                        id="conversations-filter-guest-email"
                        type="email"
                        placeholder={t('conversations.form.emailPlaceholder')}
                        value={search.guestEmail ?? ''}
                        onChange={handleGuestEmailChange}
                        className="w-[220px]"
                    />
                </div>

                {/* Clear filters */}
                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearFilters}
                    >
                        {t('conversations.filters.clear')}
                    </Button>
                )}
            </div>

            {/* Inbox table */}
            <InboxList
                items={items}
                total={total}
                page={search.page}
                pageSize={search.pageSize}
                onPageChange={handlePageChange}
                isLoading={isLoading}
            />
        </div>
    );
}
