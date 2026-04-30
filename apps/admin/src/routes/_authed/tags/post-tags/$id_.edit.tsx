import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { PostTagForm } from '@/components/tags/PostTagForm';
import { usePostTag, useUpdatePostTag } from '@/hooks/use-post-tags';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import type { UpdatePostTagInput } from '@repo/schemas';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/tags/post-tags/$id_/edit')({
    component: PostTagEditPage,
    loader: async ({ params }) => ({ postTagId: params.id }),
    errorComponent: createErrorComponent('PostTag'),
    pendingComponent: createPendingComponent()
});

/**
 * PostTag edit page.
 *
 * Fetches the existing PostTag by ID and renders the shared `PostTagForm`
 * in "edit" mode with prefilled values. On success navigates to the list.
 *
 * Gate: requires `POST_TAG_UPDATE` permission.
 *
 * @see SPEC-086 Phase 7 / T-029
 */
function PostTagEditPage() {
    const { id } = Route.useParams();
    const navigate = useNavigate();

    const { data: tag, isLoading, error } = usePostTag(id);
    const updateMutation = useUpdatePostTag(id);

    async function handleSubmit(values: UpdatePostTagInput) {
        await updateMutation.mutateAsync(values);
        navigate({ to: '/tags/post-tags' });
    }

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.POST_TAG_UPDATE]}>
            <div className="mx-auto max-w-2xl space-y-6 p-6">
                {/* Breadcrumbs */}
                <nav
                    aria-label="Miga de pan"
                    className="text-muted-foreground text-sm"
                >
                    <ol className="flex items-center gap-1">
                        <li>
                            <Link
                                to="/tags/post-tags"
                                className="hover:underline"
                            >
                                Etiquetas de publicaciones
                            </Link>
                        </li>
                        <li aria-hidden="true">/</li>
                        <li aria-current="page">{tag?.name ?? 'Editar etiqueta'}</li>
                    </ol>
                </nav>

                <div>
                    <h1 className="font-bold text-2xl">Editar etiqueta de publicación</h1>
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
                    <PostTagForm
                        mode="edit"
                        onSubmit={handleSubmit}
                        isSubmitting={updateMutation.isPending}
                        defaultValues={{
                            name: tag.name,
                            slug: tag.slug,
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
