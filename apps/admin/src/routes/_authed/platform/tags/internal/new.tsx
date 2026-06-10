import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { AdminTagForm } from '@/components/tags/AdminTagForm';
import { useCreateInternalTag } from '@/hooks/use-internal-tags';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import type { TagCreateInput } from '@repo/schemas';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/platform/tags/internal/new')({
    component: InternalTagNewPage,
    errorComponent: createErrorComponent('InternalTag'),
    pendingComponent: createPendingComponent()
});

/**
 * INTERNAL tag create page.
 *
 * Renders the shared `AdminTagForm` in "create" mode with `tagType="INTERNAL"`.
 * The form does NOT expose slug, ownerId, or type — all injected by the hook.
 *
 * INTERNAL tags are only visible in admin contexts per D-006/D-007.
 *
 * On success navigates back to the INTERNAL tag list.
 *
 * Gate: requires `TAG_INTERNAL_CREATE` permission.
 *
 * @see SPEC-086 Phase 7 / T-030
 * @see D-002, D-006, D-007
 */
function InternalTagNewPage() {
    const navigate = useNavigate();
    const createMutation = useCreateInternalTag();

    async function handleSubmit(values: Omit<TagCreateInput, 'type' | 'ownerId'>) {
        await createMutation.mutateAsync(values);
        navigate({ to: '/platform/tags/internal' });
    }

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.TAG_INTERNAL_CREATE]}>
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
                        <li aria-current="page">Nueva etiqueta</li>
                    </ol>
                </nav>

                <div>
                    <h1 className="font-bold text-2xl">Nueva etiqueta interna</h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Las etiquetas internas son visibles únicamente para administradores. No se
                        muestran a usuarios regulares y permiten organizar entidades con criterios
                        de gestión interna.
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

                <AdminTagForm
                    mode="create"
                    tagType="INTERNAL"
                    onSubmit={handleSubmit}
                    isSubmitting={createMutation.isPending}
                />
            </div>
        </RoutePermissionGuard>
    );
}
