/**
 * @file _authed/direct-emails/templates.tsx
 * @description Direct email templates (HOS-2685): list, create, edit and delete.
 * Viewing needs DIRECT_EMAIL_VIEW; writing needs DIRECT_EMAIL_TEMPLATE_WRITE.
 */

import type { DirectEmailTemplate } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import {
    getDirectEmailErrorKey,
    useCreateDirectEmailTemplate,
    useDeleteDirectEmailTemplate,
    useDirectEmailTemplates,
    useUpdateDirectEmailTemplate
} from '@/hooks/direct-email';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { requireDirectEmailPermission } from './-components/direct-email-route-guard';
import { formatDateTime } from './-components/format-date';
import { TemplateForm } from './-components/TemplateForm';

export const Route = createFileRoute('/_authed/direct-emails/templates')({
    beforeLoad: requireDirectEmailPermission({ permission: PermissionEnum.DIRECT_EMAIL_VIEW }),
    component: DirectEmailTemplatesPage
});

/** What the form panel is doing: nothing, creating, or editing one template. */
type Editing = null | 'new' | DirectEmailTemplate;

function DirectEmailTemplatesPage() {
    const { t, locale } = useTranslations();
    const { addToast } = useToast();
    const canWrite = useHasPermission(PermissionEnum.DIRECT_EMAIL_TEMPLATE_WRITE);
    const [page, setPage] = useState(1);
    const [editing, setEditing] = useState<Editing>(null);
    const [pendingDelete, setPendingDelete] = useState<DirectEmailTemplate | null>(null);

    const { data, isLoading, error } = useDirectEmailTemplates({ page, pageSize: 25 });
    const createMutation = useCreateDirectEmailTemplate();
    const updateMutation = useUpdateDirectEmailTemplate();
    const deleteMutation = useDeleteDirectEmailTemplate();

    const items = data?.items ?? [];
    const pagination = data?.pagination;

    async function handleSubmit(input: Parameters<typeof createMutation.mutateAsync>[0]) {
        try {
            if (editing && editing !== 'new') {
                await updateMutation.mutateAsync({ id: editing.id, data: input });
                addToast({
                    message: t('admin-direct-email.templates.updatedToast'),
                    variant: 'success'
                });
            } else {
                await createMutation.mutateAsync(input);
                addToast({
                    message: t('admin-direct-email.templates.createdToast'),
                    variant: 'success'
                });
            }
            setEditing(null);
        } catch (err) {
            addToast({ message: t(getDirectEmailErrorKey({ error: err })), variant: 'error' });
        }
    }

    async function handleDelete() {
        if (!pendingDelete) return;
        try {
            await deleteMutation.mutateAsync({ id: pendingDelete.id });
            addToast({
                message: t('admin-direct-email.templates.deletedToast'),
                variant: 'success'
            });
        } catch (err) {
            addToast({ message: t(getDirectEmailErrorKey({ error: err })), variant: 'error' });
        } finally {
            setPendingDelete(null);
        }
    }

    return (
        <SidebarPageLayout
            titleKey="admin-direct-email.templates.title"
            actions={
                <div className="flex flex-wrap gap-2">
                    <Button
                        asChild
                        variant="outline"
                    >
                        <Link to="/direct-emails">
                            {t('admin-direct-email.templates.backToList')}
                        </Link>
                    </Button>
                    {canWrite && editing === null && (
                        <Button onClick={() => setEditing('new')}>
                            {t('admin-direct-email.templates.new')}
                        </Button>
                    )}
                </div>
            }
        >
            <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                    {t('admin-direct-email.templates.subtitle')}
                </p>
                {!canWrite && (
                    <p className="text-muted-foreground text-xs">
                        {t('admin-direct-email.templates.readOnlyNotice')}
                    </p>
                )}

                {editing !== null && canWrite && (
                    <TemplateForm
                        key={editing === 'new' ? 'new' : editing.id}
                        initial={editing === 'new' ? null : editing}
                        isPending={createMutation.isPending || updateMutation.isPending}
                        onSubmit={handleSubmit}
                        onCancel={() => setEditing(null)}
                    />
                )}

                {isLoading && (
                    <p className="text-muted-foreground text-sm">
                        {t('admin-direct-email.templates.loading')}
                    </p>
                )}
                {error && (
                    <p
                        role="alert"
                        className="text-destructive text-sm"
                    >
                        {t('admin-direct-email.templates.loadError')}
                    </p>
                )}
                {!isLoading && !error && items.length === 0 && (
                    <p className="py-10 text-center text-muted-foreground">
                        {t('admin-direct-email.templates.empty')}
                    </p>
                )}

                {items.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border bg-card">
                        <table
                            className="w-full text-sm"
                            aria-label={t('admin-direct-email.templates.tableLabel')}
                        >
                            <thead className="bg-muted/50 text-left">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        {t('admin-direct-email.templates.colName')}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t('admin-direct-email.templates.colSubject')}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t('admin-direct-email.templates.colUpdated')}
                                    </th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((template) => (
                                    <tr
                                        key={template.id}
                                        className="border-t"
                                    >
                                        <td className="px-4 py-3 font-medium">{template.name}</td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {template.subject}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {formatDateTime({ value: template.updatedAt, locale })}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {canWrite && (
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setEditing(template)}
                                                    >
                                                        {t('admin-direct-email.templates.edit')}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setPendingDelete(template)}
                                                    >
                                                        {t('admin-direct-email.templates.delete')}
                                                    </Button>
                                                </div>
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
                open={pendingDelete !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingDelete(null);
                }}
                title={t('admin-direct-email.templates.deleteTitle')}
                description={t('admin-direct-email.templates.deleteDescription', {
                    name: pendingDelete?.name ?? ''
                })}
                cancelLabel={t('admin-direct-email.templates.cancel')}
                confirmLabel={t('admin-direct-email.templates.deleteConfirm')}
                onConfirm={() => void handleDelete()}
            />
        </SidebarPageLayout>
    );
}
