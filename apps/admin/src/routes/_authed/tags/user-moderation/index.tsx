import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { AdminTagDeleteDialog } from '@/components/tags/AdminTagDeleteDialog';
import { UserTagModerationTable } from '@/components/tags/UserTagModerationTable';
import { Button } from '@/components/ui/button';
import { useDeleteAnyUserTag, useUserTagModerationList } from '@/hooks/use-user-tag-moderation';
import type { UserTagWithOwner } from '@/hooks/use-user-tag-moderation';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { TagsIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/tags/user-moderation/')({
    component: UserTagModerationPage,
    errorComponent: createErrorComponent('UserTagModeration'),
    pendingComponent: createPendingComponent()
});

/**
 * USER tag moderation page.
 *
 * Lists ALL USER tags across all owners. Groups by owner for readability.
 * The only available action per row is DELETE (TAG_USER_DELETE_ANY) — per D-012,
 * there is NO edit/rename action for USER tags from admin.
 *
 * Gate: requires `TAG_VIEW_ALL_USER_TAGS` permission.
 * Delete action additionally requires `TAG_USER_DELETE_ANY` on the server side;
 * the UI hides the delete column when the actor lacks the permission.
 *
 * @see SPEC-086 Phase 7 / T-031
 * @see D-012 (no UPDATE_ANY for USER tags)
 * @see AC-008-01, AC-008-02
 */
function UserTagModerationPage() {
    const [page, setPage] = useState(1);
    const [filterSearch, setFilterSearch] = useState('');

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedForDelete, setSelectedForDelete] = useState<UserTagWithOwner | null>(null);

    const { data, isLoading, error } = useUserTagModerationList({
        page,
        pageSize: 50,
        search: filterSearch || undefined
    });

    const deleteMutation = useDeleteAnyUserTag();

    const items = data?.data?.items ?? [];
    const pagination = data?.data?.pagination;

    function handleDeleteClick(tag: UserTagWithOwner) {
        setSelectedForDelete(tag);
        setDeleteDialogOpen(true);
    }

    async function handleConfirmDelete() {
        if (!selectedForDelete) return;
        await deleteMutation.mutateAsync(selectedForDelete.id);
        setDeleteDialogOpen(false);
        setSelectedForDelete(null);
    }

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.TAG_VIEW_ALL_USER_TAGS]}>
            <div className="space-y-6 p-6">
                {/* Page header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TagsIcon
                            className="h-6 w-6 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <div>
                            <h1 className="font-bold text-2xl">
                                Moderación de etiquetas de usuario
                            </h1>
                            <p className="mt-0.5 text-muted-foreground text-sm">
                                Etiquetas privadas creadas por usuarios. Solo visible para admins.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Search filter */}
                <div className="flex flex-wrap gap-3">
                    <input
                        type="text"
                        placeholder="Buscar por nombre de etiqueta..."
                        value={filterSearch}
                        onChange={(e) => {
                            setFilterSearch(e.target.value);
                            setPage(1);
                        }}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        aria-label="Buscar etiquetas de usuario"
                    />
                </div>

                {/* Content */}
                {isLoading && (
                    <p className="text-muted-foreground text-sm">Cargando etiquetas...</p>
                )}

                {error && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                    >
                        Error al cargar las etiquetas. Intentá de nuevo.
                    </p>
                )}

                {!isLoading && !error && (
                    <UserTagModerationTable
                        tags={items}
                        onDeleteClick={handleDeleteClick}
                        isDeleting={deleteMutation.isPending}
                        deletingTagId={selectedForDelete?.id}
                        canDeleteAny={true}
                    />
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div
                        className="flex items-center justify-between text-sm"
                        aria-label="Paginación"
                    >
                        <span className="text-muted-foreground">
                            {pagination.total} etiquetas en total
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => p - 1)}
                                aria-label="Página anterior"
                            >
                                Anterior
                            </Button>
                            <span className="flex items-center px-2">
                                {page} / {pagination.totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= pagination.totalPages}
                                onClick={() => setPage((p) => p + 1)}
                                aria-label="Página siguiente"
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete confirmation dialog — rendered once, controlled by state */}
            {selectedForDelete && (
                <AdminTagDeleteDialog
                    tagId={selectedForDelete.id}
                    tagName={selectedForDelete.name}
                    tagType="INTERNAL"
                    impactCount={selectedForDelete.usageCount ?? 0}
                    isLoadingImpact={false}
                    open={deleteDialogOpen}
                    onOpenChange={(isOpen) => {
                        if (!isOpen) {
                            setDeleteDialogOpen(false);
                            setSelectedForDelete(null);
                        }
                    }}
                    onConfirm={handleConfirmDelete}
                    isDeleting={deleteMutation.isPending}
                    trigger={<span />}
                />
            )}
        </RoutePermissionGuard>
    );
}
