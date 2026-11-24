import { Text } from '@react-email/components';
import { EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';
import { formatDate } from '../utils/format-helpers.js';
import {
    type ReconciliationReasonLabelResolver,
    resolveReasonLabel,
    subjectTypeLabel
} from './reconciliation-labels.js';
import { describeSubject } from './reconciliation-subject-detail.js';
import type { ReconciliationSummaryContext } from './reconciliation-summary-enrichment.js';
import { adminPanelHref, StaffNoticeAction, StaffNoticeRows } from './staff-notice.js';

/** Payload for an immediate duplicate-charge notice to billing staff. */
export interface DuplicateChargeDetectedProps {
    readonly markId: string;
    readonly subjectType: 'subscription' | 'addon_instance';
    readonly subjectId: string;
    readonly reason: 'COBRO_DUPLICADO';
    readonly openedAt: string;
    readonly paymentId: string | null;
    /** Admin base URL. Absent: no button, a sentence names the menu path. */
    readonly adminUrl?: string;
    /** Holder and plan resolved at render time (HOS-2565 D9). Absent: those rows are omitted. */
    readonly context?: ReconciliationSummaryContext;
    /** Reason label injected by `apps/api` (HOS-2565 D8). */
    readonly resolveReasonLabel?: ReconciliationReasonLabelResolver;
}

/** Subject of the immediate duplicate-charge email. */
export const DUPLICATE_CHARGE_DETECTED_SUBJECT = 'Cobro duplicado detectado';

/** Explains that a duplicate charge needs a staff-confirmed refund. */
export function DuplicateChargeDetected(props: DuplicateChargeDetectedProps) {
    const detail = describeSubject({
        context: props.context,
        subjectType: props.subjectType,
        subjectId: props.subjectId
    });
    return (
        <EmailLayout
            variant="staff"
            previewText={DUPLICATE_CHARGE_DETECTED_SUBJECT}
        >
            <Heading>{DUPLICATE_CHARGE_DETECTED_SUBJECT}</Heading>
            <Text>
                Se abrió una marca por cobro duplicado: un período quedó con dos cobros acreditados
                y uno de ellos no compró nada.
            </Text>
            <StaffNoticeRows
                rows={[
                    {
                        label: 'Motivo',
                        value: resolveReasonLabel({
                            reason: props.reason,
                            resolve: props.resolveReasonLabel
                        })
                    },
                    {
                        label: 'Sujeto',
                        value: `${subjectTypeLabel(props.subjectType)} ${props.subjectId}`
                    },
                    { label: 'Titular', value: detail?.holder },
                    { label: 'Plan', value: detail?.plan },
                    { label: 'Pago', value: props.paymentId ? props.paymentId : null },
                    { label: 'Abierta el', value: formatDate({ dateString: props.openedAt }) }
                ]}
            />
            <StaffNoticeAction
                action="Hay plata del cliente por devolver: confirmá el reembolso desde el panel de administración."
                panelHref={adminPanelHref({
                    adminUrl: props.adminUrl,
                    path: `/billing/reconciliation/${props.markId}/events`
                })}
                buttonLabel="Abrir la marca en el panel"
                menuPath="Facturación → Conciliación"
            />
        </EmailLayout>
    );
}
