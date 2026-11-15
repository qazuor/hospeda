import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject of the notice sent before cancelling an expired addon authorization. */
export const ADDON_AUTHORIZATION_EXPIRED_SUBJECT = 'Venció la autorización de tu addon';

/** The A3 notice sent before cancelling a recurring addon's preapproval. */
export function AddonAuthorizationExpired() {
    return (
        <EmailLayout previewText={ADDON_AUTHORIZATION_EXPIRED_SUBJECT}>
            <Heading>{ADDON_AUTHORIZATION_EXPIRED_SUBJECT}</Heading>
            <Text>
                Venció el plazo para autorizar tu addon y cancelamos su suscripción en Mercado Pago.
                No se te cobró nada. Puede llegarte un correo de Mercado Pago avisando la
                cancelación.
            </Text>
        </EmailLayout>
    );
}
