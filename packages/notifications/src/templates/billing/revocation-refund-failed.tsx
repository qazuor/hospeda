import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatCurrency, formatDate } from '../utils/format-helpers.js';

/** Props used to render a failed revocation refund email.
 *
 * @property refundId - Identifier of the refund that failed.
 * @property refundReason - RF1 reason that caused the refund.
 * @property sourceKind - Kind of payment source for the refund.
 * @property sourceId - Identifier of the payment source.
 * @property subjectType - Type of the associated service subject, when present.
 * @property subjectId - Identifier of the associated service subject, when present.
 * @property amountMinor - Refund amount in minor currency units.
 * @property currency - Currency code, or null when unavailable.
 * @property failedAt - ISO timestamp when the refund failed.
 */
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

/** Subject line shared by the failed revocation refund email template and renderer. */
export const REVOCATION_REFUND_FAILED_SUBJECT = 'Falló un reembolso por revocación';

/** Renders the transactional email shown when a revocation refund fails.
 *
 * @param props - Data displayed in the failed refund email.
 * @param props.refundId - Identifier of the refund that failed.
 * @param props.refundReason - RF1 reason that caused the refund.
 * @param props.sourceKind - Kind of payment source for the refund.
 * @param props.sourceId - Identifier of the payment source.
 * @param props.subjectType - Type of the associated service subject, when present.
 * @param props.subjectId - Identifier of the associated service subject, when present.
 * @param props.amountMinor - Refund amount in minor currency units.
 * @param props.currency - Currency code, or null when unavailable.
 * @param props.failedAt - ISO timestamp when the refund failed.
 * @returns The rendered failed refund email.
 */
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
