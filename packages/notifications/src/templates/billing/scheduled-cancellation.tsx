import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';

/** Subject of the notice sent before a cancelled subscription's automatic charge is cancelled. */
export const SCHEDULED_CANCELLATION_SUBJECT = 'Cancelamos el cobro automático de tu suscripción';

/** Props of {@link ScheduledCancellation}. */
export interface ScheduledCancellationProps {
    /** Formatted end of the paid service, or null when the producer could not read it. */
    readonly serviceEndDate: string | null;
    /** Display name of the plan; absent on rows queued before HOS-2580. */
    readonly planName?: string | null;
    /**
     * Whether the subscription's vertical publishes listings (accommodation, venue,
     * experience). When the service ends, those listings stop being published
     * (`UNPUBLISHED_BY_BILLING`); other verticals lose what the plan includes.
     */
    readonly hasListings: boolean;
    /** Absolute URL of Mi Suscripción. */
    readonly subscriptionUrl: string;
}

/**
 * The email that precedes cancelling the preapproval of a subscription the person asked to
 * cancel (S11, and S12, which inherits S11's cancellation; kind `SCHEDULED_CANCELLATION`,
 * HOS-1683, AC:1683:2, DEC-MAIL-001): no further charge, the service runs to the end of the
 * paid period, and Mercado Pago may send its own cancellation email.
 *
 * The "after" copy says only what the code does (HOS-2580 §A): there is no free plan to go
 * back to, and a scheduled cancellation cannot be undone (PROH:B:1), so the way back is a
 * new subscription.
 *
 * @param props - See {@link ScheduledCancellationProps}
 */
export function ScheduledCancellation({
    serviceEndDate,
    planName,
    hasListings,
    subscriptionUrl
}: ScheduledCancellationProps) {
    const until = serviceEndDate ? `el ${serviceEndDate}` : 'el final del período que ya pagaste';
    const planLabel = planName && planName.trim() !== '' ? planName : null;
    return (
        <EmailLayout previewText={`Tu suscripción sigue hasta ${until}`}>
            <Heading>{SCHEDULED_CANCELLATION_SUBJECT}</Heading>
            <Text>
                {planLabel ? (
                    <>
                        Pediste la baja de tu plan <strong>{planLabel}</strong>, así que cancelamos
                        su cobro automático: no se te va a volver a cobrar.
                    </>
                ) : (
                    'Pediste la baja de tu suscripción, así que cancelamos su cobro automático: no se te va a volver a cobrar.'
                )}{' '}
                El servicio sigue hasta {until}.
            </Text>
            <Callout tone="info">
                {planLabel ? (
                    <InfoRow
                        label="Plan"
                        value={planLabel}
                    />
                ) : null}
                <InfoRow
                    label="Servicio hasta"
                    value={serviceEndDate ?? 'Final del período pagado'}
                />
                <InfoRow
                    label="Estado"
                    value="Baja programada"
                />
            </Callout>
            <Text>
                {hasListings
                    ? 'Cuando termine el servicio, tus avisos dejan de estar publicados en Hospeda.'
                    : 'Cuando termine el servicio, dejás de tener lo que incluye tu plan.'}{' '}
                Si querés seguir, podés volver a contratar un plan desde Mi Suscripción.
            </Text>
            <Button href={subscriptionUrl}>Ver mi suscripción</Button>
            <Text>Puede llegarte un correo de Mercado Pago avisando la cancelación.</Text>
        </EmailLayout>
    );
}
