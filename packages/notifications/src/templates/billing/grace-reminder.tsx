import { Text } from '@react-email/components';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

export const GRACE_REMINDER_SUBJECT = 'Tu suscripción sigue en período de gracia';

/** Reminder sent while a subscription remains in its grace period. */
export function GraceReminder({
    vertical,
    graceEndDate,
    daysBefore,
    subscriptionUrl
}: {
    readonly vertical: string;
    readonly graceEndDate: string;
    readonly daysBefore: number;
    readonly subscriptionUrl: string;
}) {
    const verticalName = formatTrialVerticals({ verticals: [vertical] });
    const remaining = daysBefore === 1 ? '1 día' : `${daysBefore} días`;
    return (
        <EmailLayout previewText={GRACE_REMINDER_SUBJECT}>
            <Heading>{GRACE_REMINDER_SUBJECT}</Heading>
            <Text>
                Tu suscripción de {verticalName} sigue en período de gracia. Faltan {remaining} para
                el {formatDate({ dateString: graceEndDate })}, cuando termina este período.
            </Text>
            <Text>
                Si cambiás la tarjeta en Mercado Pago, el cobro se reintenta en el momento. No
                podemos garantizar que se apruebe.
            </Text>
            <Text>
                Si el cobro no entra antes de esa fecha, tu suscripción se suspende y vas a tener
                que volver a suscribirte. Mi Suscripción: {subscriptionUrl}
            </Text>
        </EmailLayout>
    );
}
