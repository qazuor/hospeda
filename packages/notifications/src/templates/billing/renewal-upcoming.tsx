import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/** Props for the PLAZO:13 renewal notice. */
export interface RenewalUpcomingProps {
    readonly planName: string;
    readonly renewalDate: string;
    readonly daysBefore: number;
}

/** Subject of the PLAZO:13 notice for AC:B13a:13; owner approval is requested in the PR (H-6). */
export const RENEWAL_UPCOMING_SUBJECT = 'Tu suscripción se renueva pronto';

/**
 * Announces the customer's renewal date under PLAZO:13 and AC:B13a:13.
 * The owner approves this customer facing copy in the PR (H-6).
 */
export function RenewalUpcoming({ planName, renewalDate, daysBefore }: RenewalUpcomingProps) {
    const previewText =
        daysBefore === 1
            ? 'Falta 1 día para la renovación de tu plan'
            : `Faltan ${daysBefore} días para la renovación de tu plan`;

    return (
        <EmailLayout previewText={previewText}>
            <Heading>{RENEWAL_UPCOMING_SUBJECT}</Heading>
            <Text>
                Tu plan {planName} se renueva el {formatDate({ dateString: renewalDate })}.
            </Text>
            <Text>
                Ese día Mercado Pago te va a cobrar la cuota con el medio de pago que autorizaste.
                No tenés que hacer nada.
            </Text>
            <Text>
                Si no querés renovar, podés darte de baja desde Mi Suscripción antes de esa fecha.
            </Text>
        </EmailLayout>
    );
}
