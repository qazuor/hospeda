import { PartnerContentReviewStateEnum, PermissionEnum } from '@repo/schemas';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { useToast } from '@/components/ui/ToastProvider';
import { PartnerMentionsSection } from '@/features/partners/components/PartnerMentionsSection';
import {
    usePartnerQuery,
    useRegisterPartnerManualPaymentMutation,
    useSendPartnerPaymentLinkMutation
} from '@/features/partners/hooks/usePartnerQuery';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { formatCalendarShortDate, formatShortDate } from '@/lib/format-helpers';
import { SendPaymentLinkCard } from './-components/SendPaymentLinkCard';

/** Spanish labels for {@link PartnerContentReviewStateEnum}, plus "never submitted". */
const CONTENT_REVIEW_STATE_LABELS: Record<PartnerContentReviewStateEnum, string> = {
    [PartnerContentReviewStateEnum.PENDING]: 'Pendiente',
    [PartnerContentReviewStateEnum.APPROVED]: 'Aprobado',
    [PartnerContentReviewStateEnum.REJECTED]: 'Rechazado'
};

const NEVER_SUBMITTED_LABEL = 'Sin contenido enviado';

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
    const { addToast } = useToast();

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
                        <span className="font-medium">Revisión de contenido:</span>{' '}
                        {partner.contentReviewState
                            ? CONTENT_REVIEW_STATE_LABELS[partner.contentReviewState]
                            : NEVER_SUBMITTED_LABEL}
                    </div>
                    <div>
                        <span className="font-medium">Contenido aprobado:</span>{' '}
                        {partner.contentApprovedAt
                            ? formatShortDate({ date: partner.contentApprovedAt })
                            : 'Sin aprobar'}
                    </div>
                    <div>
                        <span className="font-medium">Inicio:</span>{' '}
                        {/*
                          startsAt/endsAt are calendar dates: PartnerForm writes them from a
                          bare <input type="date">, which pins them to UTC midnight. Format
                          with the UTC-pinned helper so a reader at UTC-3 doesn't see the
                          date roll back a day.
                        */}
                        {partner.startsAt
                            ? formatCalendarShortDate({ date: partner.startsAt })
                            : 'Sin iniciar'}
                    </div>
                    <div>
                        <span className="font-medium">Fin:</span>{' '}
                        {partner.endsAt
                            ? formatCalendarShortDate({ date: partner.endsAt })
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
                    <SendPaymentLinkCard
                        partner={partner}
                        mutation={sendLinkMutation}
                        addToast={addToast}
                    />

                    <div className="space-y-3 rounded-lg border p-4">
                        <h2 className="font-medium text-lg">Registrar pago manual</h2>
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

                <PartnerMentionsSection partnerId={partner.id} />
            </div>
        </RoutePermissionGuard>
    );
}
