import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

export function SignupBeforeCancel() {
    return (
        <EmailLayout previewText="Tu autorización pendiente venció">
            <Heading>Tu autorización pendiente venció</Heading>
            <Text>
                Venció el plazo para completar el alta, así que vamos a cancelar la autorización
                pendiente. Va a llegar un correo de Mercado Pago avisando la cancelación. No se hará
                ningún cobro.
            </Text>
        </EmailLayout>
    );
}
