import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

export interface SignupConfirmedProps {
    readonly planName: string;
    readonly firstChargeDate: string;
}

export function SignupConfirmed({ planName, firstChargeDate }: SignupConfirmedProps) {
    return (
        <EmailLayout previewText="Tu suscripción ya está activa">
            <Heading>Tu suscripción está activa</Heading>
            <Text>Ya autorizaste el plan {planName}.</Text>
            <Text>
                Va a llegar un correo de Mercado Pago diciendo que ya pagaste. El primer cobro real
                es el {formatDate({ dateString: firstChargeDate })}.
            </Text>
        </EmailLayout>
    );
}
