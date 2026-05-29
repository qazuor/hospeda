import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { AdminTagForm } from '@/components/tags/AdminTagForm';
import { useCreateSystemTag } from '@/hooks/use-system-tags';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import type { TagCreateInput } from '@repo/schemas';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/platform/tags/system/new')({
    component: SystemTagNewPage,
    errorComponent: createErrorComponent('SystemTag'),
    pendingComponent: createPendingComponent()
});

/**
 * SYSTEM tag create page.
 *
 * Renders the shared `AdminTagForm` in "create" mode with `tagType="SYSTEM"`.
 * The form does NOT expose a slug, ownerId, or type field — all are injected
 * automatically by the hook per D-002.
 *
 * On success navigates back to the SYSTEM tag list.
 *
 * Gate: requires `TAG_SYSTEM_CREATE` permission.
 *
 * @see SPEC-086 Phase 7 / T-030
 * @see D-002, D-012
 */
function SystemTagNewPage() {
    const navigate = useNavigate();
    const createMutation = useCreateSystemTag();

    async function handleSubmit(values: Omit<TagCreateInput, 'type' | 'ownerId'>) {
        await createMutation.mutateAsync(values);
        navigate({ to: '/platform/tags/system' });
    }

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.TAG_SYSTEM_CREATE]}>
            <div className="mx-auto max-w-2xl space-y-6 p-6">
                {/* Breadcrumbs */}
                <nav
                    aria-label="Miga de pan"
                    className="text-muted-foreground text-sm"
                >
                    <ol className="flex items-center gap-1">
                        <li>
                            <Link
                                to="/platform/tags/system"
                                className="hover:underline"
                            >
                                Etiquetas de sistema
                            </Link>
                        </li>
                        <li aria-hidden="true">/</li>
                        <li aria-current="page">Nueva etiqueta</li>
                    </ol>
                </nav>

                <div>
                    <h1 className="font-bold text-2xl">Nueva etiqueta de sistema</h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Las etiquetas de sistema están disponibles para todos los usuarios
                        autenticados y pueden asignarse a cualquier entidad.
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
                    tagType="SYSTEM"
                    onSubmit={handleSubmit}
                    isSubmitting={createMutation.isPending}
                />
            </div>
        </RoutePermissionGuard>
    );
}
