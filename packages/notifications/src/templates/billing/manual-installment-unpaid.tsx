import { Link, Text } from '@react-email/components';
import { EmailLayout } from '@repo/email';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';
import { formatDate } from '../utils/format-helpers.js';
import { describeSubject } from './reconciliation-subject-detail.js';
import type { ReconciliationSummaryContext } from './reconciliation-summary-enrichment.js';
import { adminPanelHref, StaffNoticeAction, StaffNoticeRows } from './staff-notice.js';

/** Payload of the unpaid manual installment notice. */
export interface ManualInstallmentUnpaidProps {
    readonly manualPaymentId: string;
    readonly subscriptionId: string;
    readonly vertical: string;
    readonly periodStart: string;
    readonly openedAt: string;
    readonly firstInstallment: boolean;
    /** Admin base URL. Absent: no button, a sentence names the menu path. */
    readonly adminUrl?: string;
    /**
     * Holder and, for a `partner` subscription, its Partner, resolved at render time
     * (HOS-2565 D9, HOS-2580 §E). Absent: the "Titular" and "Aliado" rows are omitted.
     */
    readonly context?: ReconciliationSummaryContext;
}

/** Subject of the unpaid manual installment notice. */
export const MANUAL_INSTALLMENT_UNPAID_SUBJECT = 'Cuota de pago manual sin pago';

/** Tells staff that a manual installment was opened without a registered payment. */
export function ManualInstallmentUnpaid(props: ManualInstallmentUnpaidProps) {
    const detail = describeSubject({
        context: props.context,
        subjectType: 'subscription',
        subjectId: props.subscriptionId
    });
    const partner = props.context?.subscriptions.get(props.subscriptionId)?.partner ?? null;
    const partnerHref = partner
        ? adminPanelHref({ adminUrl: props.adminUrl, path: `/partners/${partner.id}` })
        : undefined;
    return (
        <EmailLayout
            variant="staff"
            previewText={MANUAL_INSTALLMENT_UNPAID_SUBJECT}
        >
            <Heading>{MANUAL_INSTALLMENT_UNPAID_SUBJECT}</Heading>
            <Text>Se abrió una cuota de pago manual y todavía no tiene un pago registrado.</Text>
            <StaffNoticeRows
                rows={[
                    { label: 'Suscripción', value: props.subscriptionId },
                    {
                        label: 'Vertical',
                        value: formatTrialVerticals({ verticals: [props.vertical] })
                    },
                    {
                        label: 'Cuota',
                        value: props.firstInstallment ? 'Primera cuota' : 'Renovación'
                    },
                    { label: 'Id de la cuota', value: props.manualPaymentId },
                    {
                        label: 'Período desde',
                        value: formatDate({ dateString: props.periodStart })
                    },
                    { label: 'Abierta el', value: formatDate({ dateString: props.openedAt }) },
                    { label: 'Aliado', value: partner?.name },
                    { label: 'Titular', value: detail?.holder }
                ]}
            />
            {partner && partnerHref ? (
                <Text>
                    <Link href={partnerHref}>Ver el aliado {partner.name} en el panel</Link>
                </Text>
            ) : null}
            <StaffNoticeAction
                action="Registrá el pago o declarala impaga desde el panel de administración."
                panelHref={adminPanelHref({
                    adminUrl: props.adminUrl,
                    path: `/billing/subscriptions/${props.subscriptionId}`
                })}
                buttonLabel="Abrir la suscripción en el panel"
                menuPath="Facturación → Suscripciones"
            />
        </EmailLayout>
    );
}
