/**
 * @file PartnerTypesScreen.tsx
 * @description Partner type catalog screen (HOS-2336 AC-3.1..3.6): table with a
 * partner count, create/edit dialog, delete confirmation, and a
 * "Mostrar borrados" toggle that reveals soft-deleted rows with a restore
 * button.
 *
 * Every write button is gated by its own `partnerType.*` permission; the route
 * itself is gated by `PARTNER_TYPE_VIEW`. A `409 PARTNER_TYPE_IN_USE` is not a
 * generic failure: the operator is told how many partners still use the type.
 */

import {
    type PartnerTypeAdminListItem,
    type PartnerTypeCreateInput,
    type PartnerTypeUpdateInput,
    PermissionEnum
} from '@repo/schemas';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/ToastProvider';
import {
    PARTNER_TYPES_PAGE_SIZE,
    readPartnerTypeInUse,
    useCreatePartnerType,
    useDeletePartnerType,
    usePartnerTypes,
    useRestorePartnerType,
    useUpdatePartnerType
} from '@/hooks/use-partner-types';
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { resolveI18nText } from '@/utils/i18n-text';
import { partnerTypesKey } from '../lib/partner-type-form';
import { PartnerTypeDialog } from './PartnerTypeDialog';

/** What the form dialog is currently doing. */
type DialogState =
    | { readonly mode: 'create' }
    | { readonly mode: 'edit'; readonly row: PartnerTypeAdminListItem };

const HEAD = 'px-3 py-2 text-left font-medium text-muted-foreground text-xs uppercase';
const CELL = 'px-3 py-2 align-middle text-sm';

/** Display name of a row, falling back to its slug. */
const rowName = (row: PartnerTypeAdminListItem): string =>
    resolveI18nText(row.nameI18n) || row.slug;

/**
 * The partner type catalog: list, create, edit, deactivate, delete, restore.
 */
export function PartnerTypesScreen() {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const permissions = useUserPermissions();
    const canCreate = permissions.includes(PermissionEnum.PARTNER_TYPE_CREATE);
    const canUpdate = permissions.includes(PermissionEnum.PARTNER_TYPE_UPDATE);
    const canDelete = permissions.includes(PermissionEnum.PARTNER_TYPE_DELETE);
    const canRestore = permissions.includes(PermissionEnum.PARTNER_TYPE_RESTORE);

    const [showDeleted, setShowDeleted] = useState(false);
    const [dialog, setDialog] = useState<DialogState | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<PartnerTypeAdminListItem | null>(null);

    const listQuery = usePartnerTypes({
        page: 1,
        pageSize: PARTNER_TYPES_PAGE_SIZE,
        ...(showDeleted ? { includeDeleted: true } : {})
    });
    const createMutation = useCreatePartnerType();
    const updateMutation = useUpdatePartnerType();
    const deleteMutation = useDeletePartnerType();
    const restoreMutation = useRestorePartnerType();

    const rows = listQuery.data?.items ?? [];

    /** Toasts a 409 in-use refusal with its count, or the generic message. */
    const toastFailure = (error: unknown, fallback: string) => {
        const inUse = readPartnerTypeInUse({ error });
        addToast({
            message: inUse.inUse
                ? t(partnerTypesKey({ path: 'messages.inUse' }), { count: inUse.count ?? '?' })
                : t(partnerTypesKey({ path: fallback })),
            variant: 'error'
        });
    };

    const handleSubmit = async (payload: Record<string, unknown>) => {
        if (!dialog) return;
        try {
            if (dialog.mode === 'create') {
                await createMutation.mutateAsync(payload as PartnerTypeCreateInput);
            } else {
                await updateMutation.mutateAsync({
                    id: dialog.row.id,
                    data: payload as PartnerTypeUpdateInput
                });
            }
            addToast({
                message: t(
                    partnerTypesKey({
                        path: dialog.mode === 'create' ? 'messages.created' : 'messages.updated'
                    })
                ),
                variant: 'success'
            });
            setDialog(null);
        } catch (error) {
            toastFailure(error, 'messages.saveError');
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteMutation.mutateAsync(deleteTarget.id);
            addToast({
                message: t(partnerTypesKey({ path: 'messages.deleted' })),
                variant: 'success'
            });
        } catch (error) {
            toastFailure(error, 'messages.deleteError');
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleRestore = async (row: PartnerTypeAdminListItem) => {
        try {
            await restoreMutation.mutateAsync(row.id);
            addToast({
                message: t(partnerTypesKey({ path: 'messages.restored' })),
                variant: 'success'
            });
        } catch {
            addToast({
                message: t(partnerTypesKey({ path: 'messages.restoreError' })),
                variant: 'error'
            });
        }
    };

    // Rebuilt every render on purpose: the cells close over the handlers above,
    // and the catalog is a handful of rows.
    const columns: ColumnDef<PartnerTypeAdminListItem>[] = [
        {
            id: 'name',
            header: t(partnerTypesKey({ path: 'columns.name' })),
            cell: ({ row }) => rowName(row.original)
        },
        {
            id: 'slug',
            header: t(partnerTypesKey({ path: 'columns.slug' })),
            cell: ({ row }) => (
                <code className="text-muted-foreground text-xs">{row.original.slug}</code>
            )
        },
        {
            id: 'weight',
            header: t(partnerTypesKey({ path: 'columns.weight' })),
            cell: ({ row }) => row.original.displayWeight
        },
        {
            id: 'state',
            header: t(partnerTypesKey({ path: 'columns.state' })),
            cell: ({ row }) => {
                const state = row.original.deletedAt
                    ? 'deleted'
                    : row.original.lifecycleState === 'ACTIVE'
                      ? 'active'
                      : 'inactive';
                return (
                    <Badge
                        variant={state === 'active' ? 'success' : 'secondary'}
                        data-testid={`partner-type-state-${row.original.id}`}
                    >
                        {t(partnerTypesKey({ path: `state.${state}` }))}
                    </Badge>
                );
            }
        },
        {
            id: 'partners',
            header: t(partnerTypesKey({ path: 'columns.partners' })),
            cell: ({ row }) => row.original.partnerCount
        },
        {
            id: 'actions',
            header: t(partnerTypesKey({ path: 'columns.actions' })),
            cell: ({ row }) => {
                const item = row.original;
                if (item.deletedAt) {
                    return canRestore ? (
                        <Button
                            size="sm"
                            variant="outline"
                            data-testid={`partner-type-restore-${item.id}`}
                            onClick={() => void handleRestore(item)}
                        >
                            {t(partnerTypesKey({ path: 'actions.restore' }))}
                        </Button>
                    ) : null;
                }
                return (
                    <div className="flex gap-2">
                        {canUpdate ? (
                            <Button
                                size="sm"
                                variant="outline"
                                data-testid={`partner-type-edit-${item.id}`}
                                onClick={() => setDialog({ mode: 'edit', row: item })}
                            >
                                {t(partnerTypesKey({ path: 'actions.edit' }))}
                            </Button>
                        ) : null}
                        {canDelete ? (
                            <Button
                                size="sm"
                                variant="outline"
                                data-testid={`partner-type-delete-${item.id}`}
                                onClick={() => setDeleteTarget(item)}
                            >
                                {t(partnerTypesKey({ path: 'actions.delete' }))}
                            </Button>
                        ) : null}
                    </div>
                );
            }
        }
    ];

    const table = useReactTable({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id
    });

    return (
        <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
                {t(partnerTypesKey({ path: 'subtitle' }))}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Switch
                        id="partner-types-show-deleted"
                        data-testid="partner-types-show-deleted"
                        checked={showDeleted}
                        onCheckedChange={setShowDeleted}
                    />
                    <Label htmlFor="partner-types-show-deleted">
                        {t(partnerTypesKey({ path: 'showDeleted' }))}
                    </Label>
                </div>
                {canCreate ? (
                    <Button
                        data-testid="partner-type-add"
                        onClick={() => setDialog({ mode: 'create' })}
                    >
                        {t(partnerTypesKey({ path: 'add' }))}
                    </Button>
                ) : null}
            </div>

            {listQuery.isLoading ? (
                <p className="p-4 text-muted-foreground text-sm">
                    {t(partnerTypesKey({ path: 'loading' }))}
                </p>
            ) : listQuery.isError ? (
                <p
                    className="p-4 text-destructive text-sm"
                    role="alert"
                >
                    {t(partnerTypesKey({ path: 'error' }))}
                </p>
            ) : rows.length === 0 ? (
                <p className="p-4 text-muted-foreground text-sm">
                    {t(partnerTypesKey({ path: 'empty' }))}
                </p>
            ) : (
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full">
                        <thead className="border-b bg-muted/40">
                            {table.getHeaderGroups().map((group) => (
                                <tr key={group.id}>
                                    {group.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            className={HEAD}
                                        >
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-b last:border-0"
                                    data-testid={`partner-type-row-${row.id}`}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td
                                            key={cell.id}
                                            className={CELL}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {dialog ? (
                <PartnerTypeDialog
                    key={dialog.mode === 'edit' ? dialog.row.id : 'create'}
                    mode={dialog.mode}
                    row={dialog.mode === 'edit' ? dialog.row : undefined}
                    isPending={createMutation.isPending || updateMutation.isPending}
                    onSubmit={(payload) => void handleSubmit(payload)}
                    onOpenChange={(open) => {
                        if (!open) setDialog(null);
                    }}
                />
            ) : null}

            {deleteTarget ? (
                <Dialog
                    open
                    onOpenChange={(open) => {
                        if (!open) setDeleteTarget(null);
                    }}
                >
                    <DialogContent data-testid="partner-type-delete-dialog">
                        <DialogHeader>
                            <DialogTitle>
                                {t(partnerTypesKey({ path: 'deleteDialog.title' }))}
                            </DialogTitle>
                            <DialogDescription>
                                {t(partnerTypesKey({ path: 'deleteDialog.message' }), {
                                    name: rowName(deleteTarget)
                                })}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                disabled={deleteMutation.isPending}
                                onClick={() => setDeleteTarget(null)}
                            >
                                {t(partnerTypesKey({ path: 'actions.cancel' }))}
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={deleteMutation.isPending}
                                data-testid="partner-type-delete-confirm"
                                onClick={() => void handleDelete()}
                            >
                                {t(partnerTypesKey({ path: 'deleteDialog.confirm' }))}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            ) : null}
        </div>
    );
}
