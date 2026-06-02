/**
 * Announcements editor — list view (SPEC-156 PR-4 T-038).
 *
 * Route: /platform/critical/announcements
 *
 * Reads the current global announcements from the `announcements.global`
 * platform-setting key (shipped in PR-1) via the `usePlatformSetting` hook
 * shipped in PR-3, renders each row with text preview + variant badge +
 * window state + dismissible badge, and exposes edit + delete actions per
 * row plus a "New announcement" CTA.
 *
 * Delete writes the array back without the deleted item via
 * `useUpdatePlatformSetting`. The full editor (create / edit forms) lives
 * in T-039 / T-040.
 *
 * Permission gate (AC-23): same as /platform/critical — requires
 * MAINTENANCE_MODE_WRITE (SUPER_ADMIN-only). Lower roles redirect to
 * /auth/forbidden.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    classifyWindow,
    formatWindowDate,
    pickPreviewText,
    pickVariantBadgeVariant
} from '@/features/announcements/helpers';
import { useFlashyToast } from '@/hooks/use-flashy-toast';
import { usePlatformSetting, useUpdatePlatformSetting } from '@/hooks/use-platform-setting';
import { useTranslations } from '@/hooks/use-translations';
import type { AuthState } from '@/lib/auth-session';
import { AddIcon, DeleteIcon, EditIcon } from '@repo/icons';
import { type AnnouncementItem, type AnnouncementsValue, PermissionEnum } from '@repo/schemas';
import { Link, createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/platform/critical/announcements/')({
    beforeLoad: ({ context }) => {
        // TYPE-WORKAROUND: TanStack Router types `beforeLoad` context as a generic
        // `Record<string, unknown>`; the `_authed` layout injects `AuthState` at runtime
        // but the type system doesn't propagate it to child route guards automatically.
        const authState = context as unknown as AuthState;
        const canWrite = authState.permissions?.includes(PermissionEnum.MAINTENANCE_MODE_WRITE);
        if (!canWrite) {
            throw redirect({ to: '/auth/forbidden' });
        }
    },
    component: AnnouncementsListPage
});

function AnnouncementsListPage() {
    const { t, locale } = useTranslations();
    const { success: toastSuccess, error: toastError } = useFlashyToast();

    const query = usePlatformSetting({ key: 'announcements.global' });
    const mutation = useUpdatePlatformSetting({ key: 'announcements.global' });

    const items: AnnouncementsValue = query.data?.row?.value ?? [];

    const handleDelete = (id: string): void => {
        if (!window.confirm(t('admin-pages.announcements.list.deleteConfirm'))) return;
        const next = items.filter((item) => item.id !== id);
        mutation.mutate(next, {
            onSuccess: () => {
                toastSuccess(t('admin-pages.announcements.list.deleteSuccess'));
            },
            onError: () => {
                toastError(t('admin-pages.announcements.list.deleteError'));
            }
        });
    };

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-pages.announcements.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-pages.announcements.subtitle')}
                    </p>
                </div>
                <Button
                    asChild
                    data-testid="new-announcement-link"
                >
                    <Link to="/platform/critical/announcements/new">
                        <AddIcon className="mr-2 h-4 w-4" />
                        {t('admin-pages.announcements.list.newAnnouncement')}
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">
                        {t('admin-pages.announcements.title')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {query.isLoading && (
                        <p
                            className="text-muted-foreground text-sm"
                            data-testid="announcements-loading"
                        >
                            {t('admin-pages.announcements.list.loading')}
                        </p>
                    )}

                    {query.isError && (
                        <p className="text-destructive text-sm">
                            {t('admin-pages.announcements.list.error')}
                        </p>
                    )}

                    {!query.isLoading && !query.isError && items.length === 0 && (
                        <div
                            className="rounded-md border bg-muted/30 p-6 text-center"
                            data-testid="announcements-empty"
                        >
                            <p className="font-medium">
                                {t('admin-pages.announcements.list.empty.title')}
                            </p>
                            <p className="mt-1 text-muted-foreground text-sm">
                                {t('admin-pages.announcements.list.empty.description')}
                            </p>
                        </div>
                    )}

                    {items.length > 0 && (
                        <ul
                            className="space-y-3"
                            data-testid="announcements-list"
                        >
                            {items.map((item) => (
                                <AnnouncementRow
                                    key={item.id}
                                    item={item}
                                    locale={locale}
                                    onDelete={() => handleDelete(item.id)}
                                    deleting={mutation.isPending}
                                    t={t}
                                />
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

interface AnnouncementRowProps {
    readonly item: AnnouncementItem;
    readonly locale: string;
    readonly onDelete: () => void;
    readonly deleting: boolean;
    readonly t: ReturnType<typeof useTranslations>['t'];
}

function AnnouncementRow({ item, locale, onDelete, deleting, t }: AnnouncementRowProps) {
    const windowState = classifyWindow(item);
    const startLabel = formatWindowDate(item.startsAt, locale);
    const endLabel = formatWindowDate(item.endsAt, locale);

    const windowText = (() => {
        switch (windowState) {
            case 'between':
                return t('admin-pages.announcements.window.between', {
                    from: startLabel ?? '',
                    to: endLabel ?? ''
                });
            case 'startsAt':
                return t('admin-pages.announcements.window.startsAt', {
                    date: startLabel ?? ''
                });
            case 'endsAt':
                return t('admin-pages.announcements.window.endsAt', {
                    date: endLabel ?? ''
                });
            default:
                return t('admin-pages.announcements.window.alwaysOn');
        }
    })();

    return (
        <li
            className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
            data-testid="announcement-row"
            data-announcement-id={item.id}
        >
            <div className="flex-1 space-y-2">
                <p className="font-medium text-sm">{pickPreviewText(item)}</p>
                <div className="flex flex-wrap gap-2">
                    <Badge variant={pickVariantBadgeVariant(item.variant)}>
                        {t(`admin-pages.announcements.variant.${item.variant}` as const)}
                    </Badge>
                    <Badge variant="outline">
                        {item.dismissible
                            ? t('admin-pages.announcements.dismissible.yes')
                            : t('admin-pages.announcements.dismissible.no')}
                    </Badge>
                    <span className="text-muted-foreground text-xs">{windowText}</span>
                </div>
            </div>

            <div className="flex flex-row items-center gap-2 sm:flex-col sm:items-end">
                <Button
                    asChild
                    variant="outline"
                    size="sm"
                    data-testid="edit-announcement-link"
                >
                    <Link
                        to="/platform/critical/announcements/$id/edit"
                        params={{ id: item.id }}
                    >
                        <EditIcon className="mr-2 h-4 w-4" />
                        {t('admin-pages.announcements.list.editAction')}
                    </Link>
                </Button>
                <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleting}
                    onClick={onDelete}
                    data-testid="delete-announcement-button"
                >
                    <DeleteIcon className="mr-2 h-4 w-4" />
                    {t('admin-pages.announcements.list.deleteAction')}
                </Button>
            </div>
        </li>
    );
}
