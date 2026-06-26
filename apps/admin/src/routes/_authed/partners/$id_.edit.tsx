import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { PartnerForm } from '@/features/partners/components/PartnerForm';
import {
    usePartnerPlansQuery,
    usePartnerQuery,
    useUpdatePartnerMutation
} from '@/features/partners/hooks/usePartnerQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/partners/$id_/edit')({
    component: PartnerEditPage,
    loader: async ({ params }) => ({ partnerId: params.id }),
    errorComponent: createErrorComponent('Partner'),
    pendingComponent: createPendingComponent()
});

function PartnerEditPage() {
    const { id } = Route.useParams();
    const navigate = useNavigate();
    const query = usePartnerQuery(id);
    const plansQuery = usePartnerPlansQuery();
    const updateMutation = useUpdatePartnerMutation(id);

    if (query.isLoading) {
        return <div className="p-6">Cargando partner...</div>;
    }

    if (!query.data) {
        return <div className="p-6">No encontramos el partner.</div>;
    }

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.PARTNER_MANAGE]}>
            <div className="space-y-6 p-6">
                <div>
                    <h1 className="font-semibold text-2xl">Editar partner</h1>
                    <p className="text-muted-foreground">
                        Actualizá sus datos comerciales y de billing.
                    </p>
                </div>

                <PartnerForm
                    initialData={query.data}
                    plans={plansQuery.data ?? []}
                    isSubmitting={updateMutation.isPending}
                    submitLabel="Guardar cambios"
                    onSubmit={async (data) => {
                        await updateMutation.mutateAsync(data as never);
                        navigate({ to: `/partners/${id}` });
                    }}
                />
            </div>
        </RoutePermissionGuard>
    );
}
