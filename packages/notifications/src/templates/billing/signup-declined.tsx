import { Text } from '@react-email/components';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject of S16's generic first-charge decline notice (HOS-1675, catalog row 19). */
export const SIGNUP_DECLINED_SUBJECT = 'No pudimos cobrar el primer pago de tu suscripción';

/** S16 transition: the generic signup-declined email for catalog row 19 (HOS-1675). */
export function SignupDeclined({
    vertical,
    subscriptionUrl
}: {
    readonly vertical: string;
    readonly subscriptionUrl: string;
}) {
    const verticalName = formatTrialVerticals({ verticals: [vertical] });
    return (
        <EmailLayout previewText={SIGNUP_DECLINED_SUBJECT}>
            <Heading>{SIGNUP_DECLINED_SUBJECT}</Heading>
            <Text>
                El primer cobro de tu suscripción de {verticalName} fue rechazado, así que el alta
                no quedó hecha. No se te cobró nada.
            </Text>
            <Text>
                En Mi Suscripción tenés los pasos para volver a intentarlo: {subscriptionUrl}
            </Text>
            <Text>Puede llegarte un correo de Mercado Pago avisando el rechazo.</Text>
        </EmailLayout>
    );
}
