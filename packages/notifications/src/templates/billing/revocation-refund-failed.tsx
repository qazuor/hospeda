import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatCurrency, formatDate } from '../utils/format-helpers.js';

export interface RevocationRefundFailedProps {
    readonly refundId: string;
    readonly refundReason: 'REVOCATION' | 'ADDON_ORPHAN' | 'ONE_TIME_ADDON_REVOCATION';
    readonly sourceKind: 'payment' | 'manual_payment';
    readonly sourceId: string;
    readonly subjectType: 'subscription' | 'addon_instance' | null;
    readonly subjectId: string | null;
    readonly amountMinor: number;
    readonly currency: string | null;
    readonly failedAt: string;
}

export const REVOCATION_REFUND_FAILED_SUBJECT = 'Falló un reembolso por revocación';

export function RevocationRefundFailed(props: RevocationRefundFailedProps) {
    const subject =
        props.subjectType && props.subjectId
            ? ` Sujeto: ${props.subjectType} ${props.subjectId}.`
            : '';
    const amount = props.currency
        ? formatCurrency({ amount: props.amountMinor, currency: props.currency })
        : `${props.amountMinor} centavos`;

    return (
        <EmailLayout previewText={REVOCATION_REFUND_FAILED_SUBJECT}>
            <Heading>{REVOCATION_REFUND_FAILED_SUBJECT}</Heading>
            <Text>
                Un reembolso pedido por una revocación quedó fallido y la plata no volvió a la
                persona. Reembolso: {props.refundId}.{subject} Monto: {amount}. Falló el{' '}
                {formatDate({ dateString: props.failedAt })}. La revocación ya canceló el servicio:
                hay que devolver el dinero por otro camino (transferencia) y asentarlo desde el
                panel de administración.
            </Text>
        </EmailLayout>
    );
}
