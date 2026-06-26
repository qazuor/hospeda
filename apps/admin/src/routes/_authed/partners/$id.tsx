import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import {
    usePartnerQuery,
    useRegisterPartnerManualPaymentMutation,
    useSendPartnerPaymentLinkMutation
} from '@/features/partners/hooks/usePartnerQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/partners/$id')({
    component: PartnerViewPage,
    loader: async ({ params }) => ({ partnerId: params.id }),
    errorComponent: createErrorComponent('Partner'),
    pendingComponent: createPendingComponent()
});

function PartnerViewPage() {
    const { id } = Route.useParams();
    const query = usePartnerQuery(id);
    const sendLinkMutation = useSendPartnerPaymentLinkMutation(id);
    const manualPaymentMutation = useRegisterPartnerManualPaymentMutation(id);
    const [manualNote, setManualNote] = useState('');

    if (query.isLoading) {
        return <div className="p-6">Cargando partner...</div>;
    }

    if (!query.data) {
        return <div className="p-6">No encontramos el partner.</div>;
    }

    const partner = query.data;

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.PARTNER_MANAGE]}>
            <div className="space-y-6 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="font-semibold text-2xl">{partner.name}</h1>
                        <p className="text-muted-foreground">{partner.slug}</p>
                    </div>
                    <Link
                        to="/partners/$id/edit"
                        params={{ id: partner.id }}
                        className="rounded-md border px-4 py-2"
                    >
                        Editar
                    </Link>
                </div>

                <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
                    <div>
                        <span className="font-medium">Tipo:</span> {partner.type}
                    </div>
                    <div>
                        <span className="font-medium">Tier:</span> {partner.tier}
                    </div>
                    <div>
                        <span className="font-medium">Estado billing:</span>{' '}
                        {partner.subscriptionStatus}
                    </div>
                    <div>
                        <span className="font-medium">Lifecycle:</span> {partner.lifecycleState}
                    </div>
                    <div>
                        <span className="font-medium">Inicio:</span>{' '}
                        {new Date(partner.startsAt).toLocaleDateString('es-AR')}
                    </div>
                    <div>
                        <span className="font-medium">Fin:</span>{' '}
                        {partner.endsAt
                            ? new Date(partner.endsAt).toLocaleDateString('es-AR')
                            : 'Sin fecha'}
                    </div>
                    <div className="md:col-span-2">
                        <span className="font-medium">Website:</span>{' '}
                        {partner.websiteUrl ?? 'Sin sitio web'}
                    </div>
                    <div className="md:col-span-2">
                        <span className="font-medium">Descripción:</span>{' '}
                        {partner.description ?? 'Sin descripción'}
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3 rounded-lg border p-4">
                        <h2 className="font-medium text-lg">Send payment link</h2>
                        <p className="text-muted-foreground text-sm">
                            Genera un checkout real para el plan asignado al partner.
                        </p>
                        <button
                            type="button"
                            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                            disabled={sendLinkMutation.isPending}
                            onClick={async () => {
                                await sendLinkMutation.mutateAsync();
                            }}
                        >
                            {sendLinkMutation.isPending ? 'Generando...' : 'Generar link'}
                        </button>
                        {'data' in sendLinkMutation && sendLinkMutation.data ? (
                            <div className="space-y-2">
                                <span className="block font-medium text-sm">URL</span>
                                <input
                                    className="w-full rounded-md border px-3 py-2"
                                    readOnly
                                    value={sendLinkMutation.data.paymentUrl}
                                />
                            </div>
                        ) : null}
                    </div>

                    <div className="space-y-3 rounded-lg border p-4">
                        <h2 className="font-medium text-lg">Register manual payment</h2>
                        <textarea
                            className="min-h-24 w-full rounded-md border px-3 py-2"
                            placeholder="Nota interna opcional"
                            value={manualNote}
                            onChange={(event) => setManualNote(event.target.value)}
                        />
                        <button
                            type="button"
                            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                            disabled={manualPaymentMutation.isPending}
                            onClick={async () => {
                                await manualPaymentMutation.mutateAsync({
                                    note: manualNote || undefined
                                });
                            }}
                        >
                            {manualPaymentMutation.isPending
                                ? 'Activando...'
                                : 'Registrar pago manual'}
                        </button>
                    </div>
                </div>
            </div>
        </RoutePermissionGuard>
    );
}
