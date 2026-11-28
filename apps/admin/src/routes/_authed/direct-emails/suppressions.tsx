/**
 * @file _authed/direct-emails/suppressions.tsx
 * @description Suppression list of the direct email module (HOS-2685): list with
 * a reason filter, manual add and remove. Viewing needs DIRECT_EMAIL_VIEW;
 * adding and removing need DIRECT_EMAIL_SEND.
 */

import {
    CreateDirectEmailSuppressionSchema,
    type DirectEmailSuppression,
    DirectEmailSuppressionReasonEnum,
    PermissionEnum
} from '@repo/schemas';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    getDirectEmailErrorKey,
    useCreateDirectEmailSuppression,
    useDeleteDirectEmailSuppression,
    useDirectEmailSuppressions
} from '@/hooks/direct-email';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { requireDirectEmailPermission } from './-components/direct-email-route-guard';
import { formatDateTime } from './-components/format-date';

export const Route = createFileRoute('/_authed/direct-emails/suppressions')({
    beforeLoad: requireDirectEmailPermission({ permission: PermissionEnum.DIRECT_EMAIL_VIEW }),
    component: DirectEmailSuppressionsPage
});

function DirectEmailSuppressionsPage() {
    const { t, locale } = useTranslations();
    const { addToast } = useToast();
    const canManage = useHasPermission(PermissionEnum.DIRECT_EMAIL_SEND);
    const [page, setPage] = useState(1);
    const [reason, setReason] = useState<DirectEmailSuppressionReasonEnum | ''>('');
    const [newEmail, setNewEmail] = useState('');
    const [emailError, setEmailError] = useState<string | null>(null);
    const [pendingRemove, setPendingRemove] = useState<DirectEmailSuppression | null>(null);

    const { data, isLoading, error } = useDirectEmailSuppressions({
        page,
        pageSize: 25,
        reason: reason || undefined
    });
    const createMutation = useCreateDirectEmailSuppression();
    const deleteMutation = useDeleteDirectEmailSuppression();

    const items = data?.items ?? [];
    const pagination = data?.pagination;

    async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const parsed = CreateDirectEmailSuppressionSchema.safeParse({ email: newEmail });
        if (!parsed.success) {
            setEmailError(t('admin-direct-email.suppressions.addEmailInvalid'));
            return;
        }
        setEmailError(null);
        try {
            await createMutation.mutateAsync(parsed.data);
            setNewEmail('');
            addToast({
                message: t('admin-direct-email.suppressions.addedToast'),
                variant: 'success'
            });
        } catch (err) {
            addToast({ message: t(getDirectEmailErrorKey({ error: err })), variant: 'error' });
        }
    }

    async function handleRemove() {
        if (!pendingRemove) return;
        try {
            await deleteMutation.mutateAsync({ id: pendingRemove.id });
            addToast({
                message: t('admin-direct-email.suppressions.removedToast'),
                variant: 'success'
            });
        } catch (err) {
            addToast({ message: t(getDirectEmailErrorKey({ error: err })), variant: 'error' });
        } finally {
            setPendingRemove(null);
        }
    }

    return (
        <SidebarPageLayout
            titleKey="admin-direct-email.suppressions.title"
            actions={
                <Button
                    asChild
                    variant="outline"
                >
                    <Link to="/direct-emails">
                        {t('admin-direct-email.suppressions.backToList')}
                    </Link>
                </Button>
            }
        >
            <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                    {t('admin-direct-email.suppressions.subtitle')}
                </p>

                {canManage && (
                    <form
                        onSubmit={handleAdd}
                        noValidate
                        className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4"
                    >
                        <div className="flex min-w-[16rem] flex-col gap-1.5">
                            <Label htmlFor="suppression-email">
                                {t('admin-direct-email.suppressions.addEmailLabel')}
                            </Label>
                            <Input
                                id="suppression-email"
                                type="email"
                                value={newEmail}
                                placeholder={t(
                                    'admin-direct-email.suppressions.addEmailPlaceholder'
                                )}
                                onChange={(event) => setNewEmail(event.target.value)}
                                aria-invalid={emailError ? true : undefined}
                            />
                            {emailError && (
                                <p
                                    role="alert"
                                    className="text-destructive text-xs"
                                >
                                    {emailError}
                                </p>
                            )}
                        </div>
                        <Button
                            type="submit"
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending
                                ? t('admin-direct-email.suppressions.adding')
                                : t('admin-direct-email.suppressions.add')}
                        </Button>
                    </form>
                )}

                <div className="flex items-center gap-3">
                    <label
                        htmlFor="suppression-reason"
                        className="text-muted-foreground text-sm"
                    >
                        {t('admin-direct-email.suppressions.reasonFilterLabel')}:
                    </label>
                    <select
                        id="suppression-reason"
                        className="rounded-md border bg-background px-3 py-1.5 text-sm"
                        value={reason}
                        onChange={(event) => {
                            setReason(event.target.value as DirectEmailSuppressionReasonEnum | '');
                            setPage(1);
                        }}
                    >
                        <option value="">{t('admin-direct-email.suppressions.reasonAll')}</option>
                        {Object.values(DirectEmailSuppressionReasonEnum).map((value) => (
                            <option
                                key={value}
                                value={value}
                            >
                                {t(`admin-direct-email.suppressions.reason.${value}` as const)}
                            </option>
                        ))}
                    </select>
                </div>

                {isLoading && (
                    <p className="text-muted-foreground text-sm">
                        {t('admin-direct-email.suppressions.loading')}
                    </p>
                )}
                {error && (
                    <p
                        role="alert"
                        className="text-destructive text-sm"
                    >
                        {t('admin-direct-email.suppressions.loadError')}
                    </p>
                )}
                {!isLoading && !error && items.length === 0 && (
                    <p className="py-10 text-center text-muted-foreground">
                        {t('admin-direct-email.suppressions.empty')}
                    </p>
                )}

                {items.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border bg-card">
                        <table
                            className="w-full text-sm"
                            aria-label={t('admin-direct-email.suppressions.tableLabel')}
                        >
                            <thead className="bg-muted/50 text-left">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        {t('admin-direct-email.suppressions.colEmail')}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t('admin-direct-email.suppressions.colReason')}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t('admin-direct-email.suppressions.colDate')}
                                    </th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="border-t"
                                    >
                                        <td className="px-4 py-3 font-medium">{item.email}</td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {t(
                                                `admin-direct-email.suppressions.reason.${item.reason}` as const
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {formatDateTime({ value: item.createdAt, locale })}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {canManage && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setPendingRemove(item)}
                                                >
                                                    {t('admin-direct-email.suppressions.remove')}
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {pagination && pagination.totalPages > 1 && (
                    <div className="flex justify-end gap-2">
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
                )}
            </div>

            <DeleteConfirmDialog
                open={pendingRemove !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingRemove(null);
                }}
                title={t('admin-direct-email.suppressions.removeTitle')}
                description={t('admin-direct-email.suppressions.removeDescription', {
                    email: pendingRemove?.email ?? ''
                })}
                cancelLabel={t('admin-direct-email.suppressions.cancel')}
                confirmLabel={t('admin-direct-email.suppressions.removeConfirm')}
                onConfirm={() => void handleRemove()}
            />
        </SidebarPageLayout>
    );
}
