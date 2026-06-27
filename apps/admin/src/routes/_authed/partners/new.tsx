import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { PartnerForm } from '@/features/partners/components/PartnerForm';
import {
    useCreatePartnerMutation,
    usePartnerPlansQuery
} from '@/features/partners/hooks/usePartnerQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/partners/new')({
    component: PartnerCreatePage,
    errorComponent: createErrorComponent('Partner'),
    pendingComponent: createPendingComponent()
});

function PartnerCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreatePartnerMutation();
    const plansQuery = usePartnerPlansQuery();

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.PARTNER_MANAGE]}>
            <div className="space-y-6 p-6">
                <div>
                    <h1 className="font-semibold text-2xl">Nuevo partner</h1>
                    <p className="text-muted-foreground">
                        Creá un partner y asignale su plan de billing.
                    </p>
                </div>

                <PartnerForm
                    plans={plansQuery.data ?? []}
                    isSubmitting={createMutation.isPending}
                    submitLabel="Crear partner"
                    onSubmit={async (data) => {
                        const created = await createMutation.mutateAsync(data as never);
                        navigate({ to: `/partners/${created.id}` });
                    }}
                />
            </div>
        </RoutePermissionGuard>
    );
}
