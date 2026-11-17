/**
 * @file HostTradeCategoriesSection.tsx
 * @description The "Categories" tab of the provider trade category catalog
 * screen (HOS-919 T-044): filters, table, create/edit dialog and delete.
 *
 * Deactivating and deleting are different acts (spec D2). Deactivation is the
 * active switch in the edit dialog: the category stops being offered but stays
 * on providers that already have it. Deleting is refused with `409
 * CATEGORY_IN_USE` while a provider uses it, and the message says to
 * deactivate instead.
 */

import {
    type HostTradeCategoryAdmin,
    type HostTradeCategoryCreateInput,
    type HostTradeCategoryUpdateInput,
    LifecycleStatusEnum,
    PermissionEnum
} from '@repo/schemas';
import type { ColumnDef } from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/ToastProvider';
import {
    isCategoryInUseError,
    useCreateHostTradeCategory,
    useDeleteHostTradeCategory,
    useHostTradeCategories,
    useHostTradeCategoryGroups,
    useUpdateHostTradeCategory
} from '@/hooks/use-host-trade-categories';
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { resolveI18nText } from '@/utils/i18n-text';
import { catalogKey } from '../lib/i18n-keys';
import { CatalogDeleteDialog, type CatalogDeleteTarget } from './CatalogDeleteDialog';
import { CatalogStateBadge } from './CatalogStateBadge';
import { CatalogTable } from './CatalogTable';
import { HostTradeCategoryDialog } from './HostTradeCategoryDialog';

const PAGE_SIZE = 50;
const GROUPS_PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 300;
const SELECT_CLASS = 'h-10 rounded-md border border-input bg-background px-3 text-sm';

type DialogState =
    | { readonly mode: 'create' }
    | { readonly mode: 'edit'; readonly row: HostTradeCategoryAdmin };

/**
 * Categories tab: filter, list, create, edit, deactivate and delete.
 */
export function HostTradeCategoriesSection() {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const permissions = useUserPermissions();
    const canCreate = permissions.includes(PermissionEnum.HOST_TRADE_CATEGORY_CREATE);
    const canUpdate = permissions.includes(PermissionEnum.HOST_TRADE_CATEGORY_UPDATE);
    const canDelete = permissions.includes(PermissionEnum.HOST_TRADE_CATEGORY_DELETE);

    const [searchText, setSearchText] = useState('');
    const [search, setSearch] = useState('');
    const [groupId, setGroupId] = useState('');
    const [lifecycleState, setLifecycleState] = useState('');
    const [page, setPage] = useState(1);
    const [dialog, setDialog] = useState<DialogState | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CatalogDeleteTarget | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchText.trim());
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchText]);

    const groupsQuery = useHostTradeCategoryGroups({ page: 1, pageSize: GROUPS_PAGE_SIZE });
    const groups = groupsQuery.data?.items ?? [];
    const groupNameById = useMemo(
        () =>
            new Map(
                groups.map((group) => [group.id, resolveI18nText(group.nameI18n) || group.slug])
            ),
        [groups]
    );

    const listQuery = useHostTradeCategories({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        groupId: groupId || undefined,
        lifecycleState: (lifecycleState || undefined) as LifecycleStatusEnum | undefined
    });
    const createMutation = useCreateHostTradeCategory();
    const updateMutation = useUpdateHostTradeCategory();
    const deleteMutation = useDeleteHostTradeCategory();

    const rows = listQuery.data?.items ?? [];
    const totalPages = listQuery.data?.pagination.totalPages ?? 1;

    const handleSubmit = async (payload: Record<string, unknown>) => {
        if (!dialog) return;
        try {
            if (dialog.mode === 'create') {
                await createMutation.mutateAsync(payload as HostTradeCategoryCreateInput);
            } else {
                await updateMutation.mutateAsync({
                    id: dialog.row.id,
                    data: payload as HostTradeCategoryUpdateInput
                });
            }
            addToast({
                message: t(
                    catalogKey({
                        path:
                            dialog.mode === 'create'
                                ? 'categories.messages.created'
                                : 'categories.messages.updated'
                    })
                ),
                variant: 'success'
            });
            setDialog(null);
        } catch {
            addToast({
                message: t(catalogKey({ path: 'categories.messages.saveError' })),
                variant: 'error'
            });
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteMutation.mutateAsync(deleteTarget.id);
            addToast({
                message: t(catalogKey({ path: 'categories.messages.deleted' })),
                variant: 'success'
            });
        } catch (error) {
            addToast({
                message: t(
                    catalogKey({
                        path: isCategoryInUseError(error)
                            ? 'categories.messages.inUse'
                            : 'categories.messages.deleteError'
                    })
                ),
                variant: 'error'
            });
        } finally {
            setDeleteTarget(null);
        }
    };

    const columns = useMemo<ColumnDef<HostTradeCategoryAdmin>[]>(
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
                id: 'group',
                header: t(catalogKey({ path: 'columns.group' })),
                cell: ({ row }) => groupNameById.get(row.original.groupId) ?? ''
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
                    <CatalogStateBadge lifecycleState={row.original.lifecycleState} />
                )
            },
            {
                id: 'actions',
                header: t(catalogKey({ path: 'columns.actions' })),
                cell: ({ row }) => (
                    <div className="flex gap-2">
                        {canUpdate ? (
                            <Button
                                size="sm"
                                variant="outline"
                                data-testid={`category-edit-${row.original.id}`}
                                onClick={() => setDialog({ mode: 'edit', row: row.original })}
                            >
                                {t(catalogKey({ path: 'actions.edit' }))}
                            </Button>
                        ) : null}
                        {canDelete ? (
                            <Button
                                size="sm"
                                variant="outline"
                                data-testid={`category-delete-${row.original.id}`}
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
        [t, canUpdate, canDelete, groupNameById]
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    data-testid="category-filter-search"
                    className="max-w-xs"
                    value={searchText}
                    placeholder={t(catalogKey({ path: 'categories.filters.search' }))}
                    onChange={(event) => setSearchText(event.target.value)}
                />
                <select
                    data-testid="category-filter-group"
                    aria-label={t(catalogKey({ path: 'categories.filters.group' }))}
                    className={SELECT_CLASS}
                    value={groupId}
                    onChange={(event) => {
                        setGroupId(event.target.value);
                        setPage(1);
                    }}
                >
                    <option value="">
                        {t(catalogKey({ path: 'categories.filters.allGroups' }))}
                    </option>
                    {groups.map((group) => (
                        <option
                            key={group.id}
                            value={group.id}
                        >
                            {resolveI18nText(group.nameI18n) || group.slug}
                        </option>
                    ))}
                </select>
                <select
                    data-testid="category-filter-state"
                    aria-label={t(catalogKey({ path: 'categories.filters.state' }))}
                    className={SELECT_CLASS}
                    value={lifecycleState}
                    onChange={(event) => {
                        setLifecycleState(event.target.value);
                        setPage(1);
                    }}
                >
                    <option value="">
                        {t(catalogKey({ path: 'categories.filters.allStates' }))}
                    </option>
                    <option value={LifecycleStatusEnum.ACTIVE}>
                        {t(catalogKey({ path: 'state.active' }))}
                    </option>
                    <option value={LifecycleStatusEnum.INACTIVE}>
                        {t(catalogKey({ path: 'state.inactive' }))}
                    </option>
                </select>
                {canCreate ? (
                    <Button
                        className="ml-auto"
                        data-testid="category-add"
                        onClick={() => setDialog({ mode: 'create' })}
                    >
                        {t(catalogKey({ path: 'categories.add' }))}
                    </Button>
                ) : null}
            </div>

            <CatalogTable
                testPrefix="category"
                rows={rows}
                columns={columns}
                isLoading={listQuery.isLoading}
                isError={listQuery.isError}
            />

            {totalPages > 1 ? (
                <div className="flex items-center justify-end gap-2 text-sm">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => setPage((current) => current - 1)}
                    >
                        ‹
                    </Button>
                    <span>
                        {page} / {totalPages}
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={page >= totalPages}
                        onClick={() => setPage((current) => current + 1)}
                    >
                        ›
                    </Button>
                </div>
            ) : null}

            {dialog ? (
                <HostTradeCategoryDialog
                    key={dialog.mode === 'edit' ? dialog.row.id : 'create'}
                    mode={dialog.mode}
                    row={dialog.mode === 'edit' ? dialog.row : undefined}
                    groups={groups}
                    isPending={createMutation.isPending || updateMutation.isPending}
                    onSubmit={handleSubmit}
                    onOpenChange={(open) => {
                        if (!open) setDialog(null);
                    }}
                />
            ) : null}

            <CatalogDeleteDialog
                scope="categories"
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
