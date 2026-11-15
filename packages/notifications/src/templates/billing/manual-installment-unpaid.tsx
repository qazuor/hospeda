import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/format-helpers.js';

/** Payload of the unpaid manual installment notice. */
export interface ManualInstallmentUnpaidProps {
    readonly manualPaymentId: string;
    readonly subscriptionId: string;
    readonly vertical: string;
    readonly periodStart: string;
    readonly openedAt: string;
    readonly firstInstallment: boolean;
}

/** Subject of the unpaid manual installment notice. */
export const MANUAL_INSTALLMENT_UNPAID_SUBJECT = 'Cuota de pago manual sin pago';

/** Tells staff that a manual installment was opened without a registered payment. */
export function ManualInstallmentUnpaid(props: ManualInstallmentUnpaidProps) {
    return (
        <EmailLayout previewText={MANUAL_INSTALLMENT_UNPAID_SUBJECT}>
            <Heading>{MANUAL_INSTALLMENT_UNPAID_SUBJECT}</Heading>
            <Text>
                Se abrió la cuota del período {formatDate({ dateString: props.periodStart })} de la
                suscripción {props.subscriptionId} sin pago registrado. Cuota:{' '}
                {props.manualPaymentId}. Se abrió el {formatDate({ dateString: props.openedAt })}.
                Registrá el pago o declarala impaga desde el panel de administración.
            </Text>
        </EmailLayout>
    );
}
