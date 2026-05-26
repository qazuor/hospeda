import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { AdminTagDeleteDialog } from '@/components/tags/AdminTagDeleteDialog';
import { PostTagColorBadge } from '@/components/tags/PostTagColorBadge';
import { Button } from '@/components/ui/button';
import { useDeleteSystemTag, useSystemTagImpact, useSystemTagsList } from '@/hooks/use-system-tags';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { DeleteIcon, TagsIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import type { Tag } from '@repo/schemas';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/tags/system/')({
    component: SystemTagsListPage,
    errorComponent: createErrorComponent('SystemTags'),
    pendingComponent: createPendingComponent()
});

/** Lifecycle state badge colors. */
const STATE_BADGE: Readonly<Record<string, string>> = {
    ACTIVE: 'bg-green-100 text-green-800',
    INACTIVE: 'bg-gray-100 text-gray-600',
    ARCHIVED: 'bg-orange-100 text-orange-700',
    DRAFT: 'bg-yellow-100 text-yellow-800'
} as const;

const STATE_LABEL: Readonly<Record<string, string>> = {
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    ARCHIVED: 'Archivado',
    DRAFT: 'Borrador'
} as const;

/**
 * SYSTEM tag list page.
 *
 * Displays a paginated table of all SYSTEM tags with columns for:
 * name, color swatch, lifecycle state, and action buttons (edit + delete).
 * Includes filter controls for lifecycle state and name substring.
 *
 * Gate: requires `TAG_SYSTEM_VIEW` permission.
 *
 * @see SPEC-086 Phase 7 / T-030
 */
function SystemTagsListPage() {
    const [page, setPage] = useState(1);
    const [filterState, setFilterState] = useState<string>('');
    const [filterName, setFilterName] = useState('');

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedForDelete, setSelectedForDelete] = useState<Tag | null>(null);

    const { data, isLoading, error } = useSystemTagsList({
        page,
        pageSize: 25,
        lifecycleState: filterState || undefined,
        name: filterName || undefined
    });

    const deleteMutation = useDeleteSystemTag();

    // Lazily fetch impact count only when the delete dialog is open.
    const { data: impactData, isLoading: isLoadingImpact } = useSystemTagImpact(
        selectedForDelete?.id ?? '',
        deleteDialogOpen && selectedForDelete !== null
    );

    const items = data?.data?.items ?? [];
    const pagination = data?.data?.pagination;

    function handleDeleteClick(tag: Tag) {
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
        <RoutePermissionGuard permissions={[PermissionEnum.TAG_SYSTEM_VIEW]}>
            <div className="space-y-6 p-6">
                {/* Page header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TagsIcon
                            className="h-6 w-6 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <h1 className="font-bold text-2xl">Etiquetas de sistema</h1>
                    </div>
                    <Button asChild>
                        <Link to="/tags/system/new">+ Nueva etiqueta de sistema</Link>
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                    <input
                        type="text"
                        placeholder="Buscar por nombre..."
                        value={filterName}
                        onChange={(e) => {
                            setFilterName(e.target.value);
                            setPage(1);
                        }}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        aria-label="Filtrar por nombre"
                    />
                    <select
                        value={filterState}
                        onChange={(e) => {
                            setFilterState(e.target.value);
                            setPage(1);
                        }}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        aria-label="Filtrar por estado"
                    >
                        <option value="">Todos los estados</option>
                        <option value="ACTIVE">Activo</option>
                        <option value="INACTIVE">Inactivo</option>
                        <option value="ARCHIVED">Archivado</option>
                        <option value="DRAFT">Borrador</option>
                    </select>
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

                {!isLoading && !error && items.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                        <TagsIcon
                            className="h-10 w-10"
                            aria-hidden="true"
                        />
                        <p>No hay etiquetas de sistema que coincidan con tu búsqueda.</p>
                        <Button
                            variant="outline"
                            asChild
                        >
                            <Link to="/tags/system/new">Crear primera etiqueta</Link>
                        </Button>
                    </div>
                )}

                {!isLoading && !error && items.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border bg-card">
                        <table
                            className="w-full text-sm"
                            aria-label="Tabla de etiquetas de sistema"
                        >
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium">Nombre</th>
                                    <th className="px-4 py-3 text-left font-medium">Color</th>
                                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {items.map((tag) => (
                                    <tr
                                        key={tag.id}
                                        className="transition-colors hover:bg-muted/30"
                                    >
                                        <td className="px-4 py-3 font-medium">
                                            <Link
                                                to="/tags/system/$id/edit"
                                                params={{ id: tag.id }}
                                                className="text-primary underline-offset-2 hover:underline"
                                            >
                                                {tag.name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3">
                                            <PostTagColorBadge color={tag.color} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATE_BADGE[tag.lifecycleState] ?? 'bg-gray-100 text-gray-600'}`}
                                            >
                                                {STATE_LABEL[tag.lifecycleState] ??
                                                    tag.lifecycleState}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <Link
                                                        to="/tags/system/$id/edit"
                                                        params={{ id: tag.id }}
                                                    >
                                                        Editar
                                                    </Link>
                                                </Button>
                                                <AdminTagDeleteDialog
                                                    tagId={tag.id}
                                                    tagName={tag.name}
                                                    tagType="SYSTEM"
                                                    impactCount={impactData?.count ?? 0}
                                                    isLoadingImpact={isLoadingImpact}
                                                    open={
                                                        deleteDialogOpen &&
                                                        selectedForDelete?.id === tag.id
                                                    }
                                                    onOpenChange={(isOpen) => {
                                                        if (!isOpen) {
                                                            setDeleteDialogOpen(false);
                                                            setSelectedForDelete(null);
                                                        }
                                                    }}
                                                    onConfirm={handleConfirmDelete}
                                                    isDeleting={deleteMutation.isPending}
                                                    trigger={
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => handleDeleteClick(tag)}
                                                            aria-label={`Eliminar ${tag.name}`}
                                                        >
                                                            <DeleteIcon className="h-4 w-4" />
                                                        </Button>
                                                    }
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
        </RoutePermissionGuard>
    );
}
