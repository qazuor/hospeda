import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/format-helpers.js';

/** Payload for an immediate duplicate-charge notice to billing staff. */
export interface DuplicateChargeDetectedProps {
    readonly markId: string;
    readonly subjectType: 'subscription' | 'addon_instance';
    readonly subjectId: string;
    readonly reason: 'COBRO_DUPLICADO';
    readonly openedAt: string;
    readonly paymentId: string | null;
}

/** Subject of the immediate duplicate-charge email. */
export const DUPLICATE_CHARGE_DETECTED_SUBJECT = 'Cobro duplicado detectado';

/** Explains that a duplicate charge needs a staff-confirmed refund. */
export function DuplicateChargeDetected(props: DuplicateChargeDetectedProps) {
    return (
        <EmailLayout previewText={DUPLICATE_CHARGE_DETECTED_SUBJECT}>
            <Heading>{DUPLICATE_CHARGE_DETECTED_SUBJECT}</Heading>
            <Text>
                Se abrió una marca por cobro duplicado: un período quedó con dos cobros acreditados
                y uno de ellos no compró nada. Sujeto: {props.subjectType} {props.subjectId}. Marca:{' '}
                {props.markId}.{props.paymentId ? ` Pago: ${props.paymentId}.` : ''} Abierta el{' '}
                {formatDate({ dateString: props.openedAt })}. Hay plata del cliente por devolver:
                confirmá el reembolso desde el panel de administración.
            </Text>
        </EmailLayout>
    );
}
