import { Text } from '@react-email/components';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject of S4's grace-started notice (HOS-1675, catalog row 4). */
export const GRACE_STARTED_SUBJECT = 'No pudimos cobrar tu suscripción';

/** S4 transition: the grace-started email for catalog row 4 (HOS-1675). */
export function GraceStarted({
    vertical,
    graceEndDate,
    subscriptionUrl
}: {
    readonly vertical: string;
    readonly graceEndDate: string;
    readonly subscriptionUrl: string;
}) {
    const verticalName = formatTrialVerticals({ verticals: [vertical] });
    return (
        <EmailLayout previewText={GRACE_STARTED_SUBJECT}>
            <Heading>{GRACE_STARTED_SUBJECT}</Heading>
            <Text>
                No pudimos cobrar la cuota de tu suscripción de {verticalName}. Tu servicio sigue
                activo hasta el {graceEndDate}.
            </Text>
            <Text>
                Si cambiás la tarjeta con la que pagás en Mercado Pago, el cobro se vuelve a
                intentar en el momento. No podemos asegurarte que entre.
            </Text>
            <Text>
                Si el cobro no entra antes del {graceEndDate}, tu suscripción se suspende y vas a
                tener que volver a suscribirte. Mi Suscripción: {subscriptionUrl}
            </Text>
        </EmailLayout>
    );
}
