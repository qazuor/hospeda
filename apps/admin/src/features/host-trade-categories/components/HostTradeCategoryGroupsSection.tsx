/**
 * @file HostTradeCategoryGroupsSection.tsx
 * @description The "Groups" tab of the provider trade category catalog screen
 * (HOS-919 T-043): table, create/edit dialog and delete confirmation.
 *
 * A delete that hits `409 CATEGORY_IN_USE` is not a generic failure. The
 * operator is told why and pointed at deactivation (spec D2), which is the
 * non-destructive way to stop offering a group that still has categories.
 */

import {
    type HostTradeCategoryGroupAdmin,
    type HostTradeCategoryGroupCreateInput,
    type HostTradeCategoryGroupUpdateInput,
    PermissionEnum
} from '@repo/schemas';
import type { ColumnDef } from '@tanstack/react-table';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/ToastProvider';
import {
    isCategoryInUseError,
    useCreateHostTradeCategoryGroup,
    useDeleteHostTradeCategoryGroup,
    useHostTradeCategoryGroups,
    useRestoreHostTradeCategoryGroup,
    useUpdateHostTradeCategoryGroup
} from '@/hooks/use-host-trade-categories';
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { resolveI18nText } from '@/utils/i18n-text';
import { catalogKey } from '../lib/i18n-keys';
import { CatalogDeleteDialog, type CatalogDeleteTarget } from './CatalogDeleteDialog';
import { CatalogStateBadge } from './CatalogStateBadge';
import { CatalogTable } from './CatalogTable';
import { HostTradeCategoryGroupDialog } from './HostTradeCategoryGroupDialog';
import { ShowDeletedToggle } from './ShowDeletedToggle';

/** Groups are a handful of headings, so one page holds the whole list. */
const PAGE_SIZE = 100;

/** What the dialog is currently doing. */
type DialogState =
    | { readonly mode: 'create' }
    | { readonly mode: 'edit'; readonly row: HostTradeCategoryGroupAdmin };

/**
 * Groups tab: list, create, edit, deactivate and delete.
 */
export function HostTradeCategoryGroupsSection() {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const permissions = useUserPermissions();
    const canCreate = permissions.includes(PermissionEnum.HOST_TRADE_CATEGORY_CREATE);
    const canUpdate = permissions.includes(PermissionEnum.HOST_TRADE_CATEGORY_UPDATE);
    const canDelete = permissions.includes(PermissionEnum.HOST_TRADE_CATEGORY_DELETE);
    const canRestore = permissions.includes(PermissionEnum.HOST_TRADE_CATEGORY_RESTORE);

    const [dialog, setDialog] = useState<DialogState | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CatalogDeleteTarget | null>(null);
    const [showDeleted, setShowDeleted] = useState(false);

    const listQuery = useHostTradeCategoryGroups({
        page: 1,
        pageSize: PAGE_SIZE,
        includeDeleted: showDeleted || undefined
    });
    const createMutation = useCreateHostTradeCategoryGroup();
    const updateMutation = useUpdateHostTradeCategoryGroup();
    const deleteMutation = useDeleteHostTradeCategoryGroup();
    const restoreMutation = useRestoreHostTradeCategoryGroup();
    const restoringId = restoreMutation.isPending ? restoreMutation.variables : undefined;

    const rows = listQuery.data?.items ?? [];

    const handleRestore = useCallback(
        async (id: string) => {
            try {
                await restoreMutation.mutateAsync(id);
                addToast({
                    message: t(catalogKey({ path: 'groups.messages.restored' })),
                    variant: 'success'
                });
            } catch {
                addToast({
                    message: t(catalogKey({ path: 'messages.restoreError' })),
                    variant: 'error'
                });
                await listQuery.refetch();
            }
        },
        [restoreMutation, addToast, t, listQuery]
    );

    const handleSubmit = async (payload: Record<string, unknown>) => {
        if (!dialog) return;
        try {
            if (dialog.mode === 'create') {
                await createMutation.mutateAsync(payload as HostTradeCategoryGroupCreateInput);
                addToast({
                    message: t(catalogKey({ path: 'groups.messages.created' })),
                    variant: 'success'
                });
            } else {
                await updateMutation.mutateAsync({
                    id: dialog.row.id,
                    data: payload as HostTradeCategoryGroupUpdateInput
                });
                addToast({
                    message: t(catalogKey({ path: 'groups.messages.updated' })),
                    variant: 'success'
                });
            }
            setDialog(null);
        } catch {
            addToast({
                message: t(catalogKey({ path: 'groups.messages.saveError' })),
                variant: 'error'
            });
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteMutation.mutateAsync(deleteTarget.id);
            addToast({
                message: t(catalogKey({ path: 'groups.messages.deleted' })),
                variant: 'success'
            });
        } catch (error) {
            addToast({
                message: t(
                    catalogKey({
                        path: isCategoryInUseError(error)
                            ? 'groups.messages.inUse'
                            : 'groups.messages.deleteError'
                    })
                ),
                variant: 'error'
            });
        } finally {
            setDeleteTarget(null);
        }
    };

    const columns = useMemo<ColumnDef<HostTradeCategoryGroupAdmin>[]>(
        () => [
            {
                id: 'name',
                header: t(catalogKey({ path: 'columns.name' })),
                cell: ({ row }) => resolveI18nText(row.original.nameI18n) || row.original.slug
            },
            {
                id: 'slug',
                header: t(catalogKey({ path: 'columns.slug' })),
                cell: ({ row }) => (
                    <code className="text-muted-foreground text-xs">{row.original.slug}</code>
                )
            },
            {
                id: 'weight',
                header: t(catalogKey({ path: 'columns.weight' })),
                cell: ({ row }) => row.original.displayWeight
            },
            {
                id: 'state',
                header: t(catalogKey({ path: 'columns.state' })),
                cell: ({ row }) => (
                    <CatalogStateBadge
                        lifecycleState={row.original.lifecycleState}
                        deletedAt={row.original.deletedAt}
                    />
                )
            },
            {
                id: 'actions',
                header: t(catalogKey({ path: 'columns.actions' })),
                cell: ({ row }) =>
                    row.original.deletedAt ? (
                        <div className="flex gap-2">
                            {canRestore ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`group-restore-${row.original.id}`}
                                    disabled={restoringId === row.original.id}
                                    onClick={() => handleRestore(row.original.id)}
                                >
                                    {t(
                                        catalogKey({
                                            path:
                                                restoringId === row.original.id
                                                    ? 'actions.restoring'
                                                    : 'actions.restore'
                                        })
                                    )}
                                </Button>
                            ) : null}
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            {canUpdate ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`group-edit-${row.original.id}`}
                                    onClick={() => setDialog({ mode: 'edit', row: row.original })}
                                >
                                    {t(catalogKey({ path: 'actions.edit' }))}
                                </Button>
                            ) : null}
                            {canDelete ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`group-delete-${row.original.id}`}
                                    onClick={() =>
                                        setDeleteTarget({
                                            id: row.original.id,
                                            name:
                                                resolveI18nText(row.original.nameI18n) ||
                                                row.original.slug
                                        })
                                    }
                                >
                                    {t(catalogKey({ path: 'actions.delete' }))}
                                </Button>
                            ) : null}
                        </div>
                    )
            }
        ],
        [t, canUpdate, canDelete, canRestore, restoringId, handleRestore]
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <ShowDeletedToggle
                    testId="group-show-deleted"
                    checked={showDeleted}
                    onChange={setShowDeleted}
                />
                {canCreate ? (
                    <Button
                        className="ml-auto"
                        data-testid="group-add"
                        onClick={() => setDialog({ mode: 'create' })}
                    >
                        {t(catalogKey({ path: 'groups.add' }))}
                    </Button>
                ) : null}
            </div>

            <CatalogTable
                testPrefix="group"
                rows={rows}
                columns={columns}
                isLoading={listQuery.isLoading}
                isError={listQuery.isError}
            />

            {dialog ? (
                <HostTradeCategoryGroupDialog
                    key={dialog.mode === 'edit' ? dialog.row.id : 'create'}
                    mode={dialog.mode}
                    row={dialog.mode === 'edit' ? dialog.row : undefined}
                    isPending={createMutation.isPending || updateMutation.isPending}
                    onSubmit={handleSubmit}
                    onOpenChange={(open) => {
                        if (!open) setDialog(null);
                    }}
                />
            ) : null}

            <CatalogDeleteDialog
                scope="groups"
                target={deleteTarget}
                isPending={deleteMutation.isPending}
                onConfirm={handleDelete}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
            />
        </div>
    );
}
