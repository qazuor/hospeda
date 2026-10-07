import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { PartnerForm } from '@/features/partners/components/PartnerForm';
import { useCreatePartnerMutation } from '@/features/partners/hooks/usePartnerQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';

export const Route = createFileRoute('/_authed/partners/new')({
    component: PartnerCreatePage,
    errorComponent: createErrorComponent('Partner'),
    pendingComponent: createPendingComponent()
});

function PartnerCreatePage() {
    const navigate = useNavigate();
    const createMutation = useCreatePartnerMutation();

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.PARTNER_MANAGE]}>
            <div className="space-y-6 p-6">
                <div>
                    <h1 className="font-semibold text-2xl">Nuevo partner</h1>
                    <p className="text-muted-foreground">Creá un partner.</p>
                </div>

                <PartnerForm
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
