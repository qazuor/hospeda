import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';

/** Props of {@link AccessEnding}. */
export interface AccessEndingProps {
    /** Display name of the plan whose service ends. */
    readonly planName: string;
    /** Formatted last day of service. */
    readonly serviceEndDate: string;
    /** Whole market-local days left until the service ends (at least 1). */
    readonly daysRemaining: number;
    /** Whether the vertical publishes listings; see {@link ScheduledCancellationProps}. */
    readonly hasListings: boolean;
    /** Absolute URL of Mi Suscripción. */
    readonly subscriptionUrl: string;
}

/** Subject of the access-ending notice, with its day count. */
export function accessEndingSubject(input: { readonly daysRemaining: number }): string {
    return input.daysRemaining === 1
        ? 'Tu acceso termina mañana'
        : `Tu acceso termina en ${input.daysRemaining} días`;
}

/**
 * The reminder sent a few days before the service of a `CANCEL_SCHEDULED` subscription ends
 * (HOS-2580 §C). The copy says only what the code does (§A): no free plan, no reactivation
 * (PROH:B:1); the way back is a new subscription from Mi Suscripción.
 *
 * @param props - See {@link AccessEndingProps}
 */
export function AccessEnding({
    planName,
    serviceEndDate,
    daysRemaining,
    hasListings,
    subscriptionUrl
}: AccessEndingProps) {
    const subject = accessEndingSubject({ daysRemaining });
    return (
        <EmailLayout
            previewText={`${subject}: tu plan ${planName} sigue hasta el ${serviceEndDate}`}
        >
            <Heading>{subject}</Heading>
            <Text>
                Te recordamos que diste de baja tu plan <strong>{planName}</strong>. El servicio
                sigue hasta el {serviceEndDate} y no se te va a volver a cobrar.
            </Text>
            <Callout tone="warning">
                <InfoRow
                    label="Plan"
                    value={planName}
                />
                <InfoRow
                    label="Servicio hasta"
                    value={serviceEndDate}
                />
                <InfoRow
                    label="Días restantes"
                    value={String(daysRemaining)}
                />
            </Callout>
            <Text>
                {hasListings
                    ? 'Después de esa fecha, tus avisos dejan de estar publicados en Hospeda.'
                    : 'Después de esa fecha, dejás de tener lo que incluye tu plan.'}{' '}
                Si querés seguir, podés volver a contratar un plan desde Mi Suscripción.
            </Text>
            <Button href={subscriptionUrl}>Ver mi suscripción</Button>
            <Text>Si querías darte de baja, no tenés que hacer nada.</Text>
        </EmailLayout>
    );
}
