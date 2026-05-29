import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { AdminTagForm } from '@/components/tags/AdminTagForm';
import { useInternalTag, useUpdateInternalTag } from '@/hooks/use-internal-tags';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import type { TagUpdateInput } from '@repo/schemas';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/platform/tags/internal/$id_/edit')({
    component: InternalTagEditPage,
    loader: async ({ params }) => ({ tagId: params.id }),
    errorComponent: createErrorComponent('InternalTag'),
    pendingComponent: createPendingComponent()
});

/**
 * INTERNAL tag edit page.
 *
 * Fetches the existing INTERNAL tag by ID and renders the shared `AdminTagForm`
 * in "edit" mode with prefilled values. On success navigates to the list.
 *
 * Per D-002: no slug field shown.
 * Per D-012: no type or ownerId field shown.
 *
 * Gate: requires `TAG_INTERNAL_UPDATE` permission.
 *
 * @see SPEC-086 Phase 7 / T-030
 * @see D-002, D-006, D-007, D-012
 */
function InternalTagEditPage() {
    const { id } = Route.useParams();
    const navigate = useNavigate();

    const { data: tag, isLoading, error } = useInternalTag(id);
    const updateMutation = useUpdateInternalTag(id);

    async function handleSubmit(values: TagUpdateInput) {
        await updateMutation.mutateAsync(values);
        navigate({ to: '/platform/tags/internal' });
    }

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.TAG_INTERNAL_UPDATE]}>
            <div className="mx-auto max-w-2xl space-y-6 p-6">
                {/* Breadcrumbs */}
                <nav
                    aria-label="Miga de pan"
                    className="text-muted-foreground text-sm"
                >
                    <ol className="flex items-center gap-1">
                        <li>
                            <Link
                                to="/platform/tags/internal"
                                className="hover:underline"
                            >
                                Etiquetas internas
                            </Link>
                        </li>
                        <li aria-hidden="true">/</li>
                        <li aria-current="page">{tag?.name ?? 'Editar etiqueta'}</li>
                    </ol>
                </nav>

                <div>
                    <h1 className="font-bold text-2xl">Editar etiqueta interna</h1>
                    {tag && (
                        <p className="mt-1 text-muted-foreground text-sm">
                            Editando: <strong>{tag.name}</strong>
                        </p>
                    )}
                </div>

                {isLoading && <p className="text-muted-foreground text-sm">Cargando etiqueta...</p>}

                {error && (
                    <div
                        className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm"
                        role="alert"
                    >
                        Error al cargar la etiqueta. Intentá de nuevo.
                    </div>
                )}

                {updateMutation.isError && (
                    <div
                        className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm"
                        role="alert"
                    >
                        Error al guardar los cambios. Por favor revisá los datos e intentá de nuevo.
                    </div>
                )}

                {!isLoading && !error && tag && (
                    <AdminTagForm
                        mode="edit"
                        tagType="INTERNAL"
                        onSubmit={handleSubmit}
                        isSubmitting={updateMutation.isPending}
                        defaultValues={{
                            name: tag.name,
                            color: tag.color,
                            icon: tag.icon ?? undefined,
                            description: tag.description ?? undefined,
                            lifecycleState: tag.lifecycleState
                        }}
                    />
                )}
            </div>
        </RoutePermissionGuard>
    );
}
