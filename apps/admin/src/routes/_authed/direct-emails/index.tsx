/**
 * @file _authed/direct-emails/index.tsx
 * @description History of sent direct emails (HOS-2685): paginated, searchable
 * by subject. Permission: DIRECT_EMAIL_VIEW.
 */

import { EmailIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDirectEmails } from '@/hooks/direct-email';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { requireDirectEmailPermission } from './-components/direct-email-route-guard';
import { formatDateTime } from './-components/format-date';

export const Route = createFileRoute('/_authed/direct-emails/')({
    beforeLoad: requireDirectEmailPermission({ permission: PermissionEnum.DIRECT_EMAIL_VIEW }),
    component: DirectEmailsListPage,
    errorComponent: createErrorComponent('DirectEmails'),
    pendingComponent: createPendingComponent()
});

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

function DirectEmailsListPage() {
    const { t, locale } = useTranslations();
    const canSend = useHasPermission(PermissionEnum.DIRECT_EMAIL_SEND);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const { data, isLoading, error } = useDirectEmails({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined
    });
    const items = data?.items ?? [];
    const pagination = data?.pagination;

    return (
        <SidebarPageLayout
            titleKey="admin-direct-email.list.title"
            actions={
                <div className="flex flex-wrap gap-2">
                    <Button
                        asChild
                        variant="outline"
                    >
                        <Link to="/direct-emails/templates">
                            {t('admin-direct-email.list.templatesLink')}
                        </Link>
                    </Button>
                    <Button
                        asChild
                        variant="outline"
                    >
                        <Link to="/direct-emails/suppressions">
                            {t('admin-direct-email.list.suppressionsLink')}
                        </Link>
                    </Button>
                    {canSend && (
                        <Button asChild>
                            <Link to="/direct-emails/new">
                                {t('admin-direct-email.list.newMessage')}
                            </Link>
                        </Button>
                    )}
                </div>
            }
        >
            <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                    {t('admin-direct-email.list.subtitle')}
                </p>
                <Input
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder={t('admin-direct-email.list.searchPlaceholder')}
                    aria-label={t('admin-direct-email.list.searchLabel')}
                    className="max-w-sm"
                />

                {isLoading && (
                    <p className="text-muted-foreground text-sm">
                        {t('admin-direct-email.list.loading')}
                    </p>
                )}
                {error && (
                    <p
                        role="alert"
                        className="text-destructive text-sm"
                    >
                        {t('admin-direct-email.list.loadError')}
                    </p>
                )}
                {!isLoading && !error && items.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                        <EmailIcon
                            className="h-10 w-10"
                            aria-hidden="true"
                        />
                        <p>
                            {search
                                ? t('admin-direct-email.list.emptySearch')
                                : t('admin-direct-email.list.empty')}
                        </p>
                    </div>
                )}

                {!isLoading && !error && items.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border bg-card">
                        <table
                            className="w-full text-sm"
                            aria-label={t('admin-direct-email.list.tableLabel')}
                        >
                            <thead className="bg-muted/50 text-left">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        {t('admin-direct-email.list.colSubject')}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t('admin-direct-email.list.colRecipients')}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t('admin-direct-email.list.colSentBy')}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t('admin-direct-email.list.colDate')}
                                    </th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((message) => (
                                    <tr
                                        key={message.id}
                                        className="border-t hover:bg-muted/20"
                                    >
                                        <td className="px-4 py-3 font-medium">{message.subject}</td>
                                        <td className="px-4 py-3">{message.recipientCount}</td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {message.replyToEmail}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {formatDateTime({ value: message.createdAt, locale })}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                asChild
                                                variant="ghost"
                                                size="sm"
                                            >
                                                <Link
                                                    to="/direct-emails/$messageId"
                                                    params={{ messageId: message.id }}
                                                >
                                                    {t('admin-direct-email.list.view')}
                                                </Link>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            {t('admin-direct-email.list.paginationSummary', {
                                page: pagination.page,
                                totalPages: pagination.totalPages,
                                total: pagination.total
                            })}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page <= 1}
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                            >
                                {t('admin-direct-email.list.previous')}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPage((current) => current + 1)}
                            >
                                {t('admin-direct-email.list.next')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </SidebarPageLayout>
    );
}
