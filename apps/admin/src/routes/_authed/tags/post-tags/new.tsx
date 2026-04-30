import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { PostTagForm } from '@/components/tags/PostTagForm';
import { useCreatePostTag } from '@/hooks/use-post-tags';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import type { CreatePostTagInput } from '@repo/schemas';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/tags/post-tags/new')({
    component: PostTagNewPage,
    errorComponent: createErrorComponent('PostTag'),
    pendingComponent: createPendingComponent()
});

/**
 * PostTag create page.
 *
 * Renders the shared `PostTagForm` in "create" mode.
 * On success navigates back to the PostTag list.
 *
 * Gate: requires `POST_TAG_CREATE` permission.
 *
 * @see SPEC-086 Phase 7 / T-029
 */
function PostTagNewPage() {
    const navigate = useNavigate();
    const createMutation = useCreatePostTag();

    async function handleSubmit(values: CreatePostTagInput) {
        await createMutation.mutateAsync(values);
        navigate({ to: '/tags/post-tags' });
    }

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.POST_TAG_CREATE]}>
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
                        <li aria-current="page">Nueva etiqueta</li>
                    </ol>
                </nav>

                <div>
                    <h1 className="font-bold text-2xl">Nueva etiqueta de publicación</h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Las PostTags son etiquetas públicas que categorizan las publicaciones del
                        blog. Aparecen en URLs públicas y afectan el SEO.
                    </p>
                </div>

                {createMutation.isError && (
                    <div
                        className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm"
                        role="alert"
                    >
                        Error al crear la etiqueta. Por favor revisá los datos e intentá de nuevo.
                    </div>
                )}

                <PostTagForm
                    mode="create"
                    onSubmit={handleSubmit}
                    isSubmitting={createMutation.isPending}
                />
            </div>
        </RoutePermissionGuard>
    );
}
