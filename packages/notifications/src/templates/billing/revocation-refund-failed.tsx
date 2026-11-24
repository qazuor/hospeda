import { Text } from '@react-email/components';
import { EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';
import { formatCurrency, formatDate } from '../utils/format-helpers.js';
import {
    refundReasonLabel,
    refundSourceKindLabel,
    subjectTypeLabel
} from './reconciliation-labels.js';
import { adminPanelHref, StaffNoticeAction, StaffNoticeRows } from './staff-notice.js';

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
 * @property adminUrl - Admin base URL. Absent: no button, a sentence names the menu path.
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
    readonly adminUrl?: string;
}

/** Subject line shared by the failed revocation refund email template and renderer. */
export const REVOCATION_REFUND_FAILED_SUBJECT = 'Falló un reembolso por revocación';

/** Renders the transactional email shown when a revocation refund fails.
 *
 * @param props - Data displayed in the failed refund email.
 * @returns The rendered failed refund email.
 */
export function RevocationRefundFailed(props: RevocationRefundFailedProps) {
    // A null currency is data the payload lacks: show the amount without a symbol and say so.
    const amount = props.currency
        ? formatCurrency({ amount: props.amountMinor, currency: props.currency })
        : `${formatCurrency({ amount: props.amountMinor, currency: '' })} (moneda no registrada)`;

    return (
        <EmailLayout
            variant="staff"
            previewText={REVOCATION_REFUND_FAILED_SUBJECT}
        >
            <Heading>{REVOCATION_REFUND_FAILED_SUBJECT}</Heading>
            <Text>
                Un reembolso pedido por una revocación quedó fallido y la plata no volvió a la
                persona.
            </Text>
            <StaffNoticeRows
                rows={[
                    { label: 'Reembolso', value: props.refundId },
                    { label: 'Motivo del reembolso', value: refundReasonLabel(props.refundReason) },
                    {
                        label: 'Origen del pago',
                        value: `${refundSourceKindLabel(props.sourceKind)} ${props.sourceId}`
                    },
                    {
                        label: 'Sujeto',
                        value:
                            props.subjectType && props.subjectId
                                ? `${subjectTypeLabel(props.subjectType)} ${props.subjectId}`
                                : null
                    },
                    { label: 'Monto', value: amount },
                    { label: 'Falló el', value: formatDate({ dateString: props.failedAt }) }
                ]}
            />
            <StaffNoticeAction
                action="La revocación ya canceló el servicio: hay que devolver el dinero por otro camino (transferencia) y asentarlo desde el panel de administración."
                panelHref={adminPanelHref({
                    adminUrl: props.adminUrl,
                    path: '/billing/reconciliation/refunds'
                })}
                buttonLabel="Abrir los reembolsos en el panel"
                menuPath="Facturación → Devoluciones propuestas"
            />
        </EmailLayout>
    );
}
