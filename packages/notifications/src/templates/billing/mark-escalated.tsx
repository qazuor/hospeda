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

/** Payload for an immediate notice that an unresolved reconciliation mark escalated. */
export interface MarkEscalatedProps {
    readonly markId: string;
    readonly subjectType: 'subscription' | 'addon_instance';
    readonly subjectId: string;
    readonly reason: string;
    readonly placedAt: string;
    readonly escalatedAt: string;
    readonly escalationDays: number;
    /** Admin base URL. Absent: no button, a sentence names the menu path. */
    readonly adminUrl?: string;
    /** Holder and plan resolved at render time (HOS-2565 D9). Absent: those rows are omitted. */
    readonly context?: ReconciliationSummaryContext;
    /** Reason label injected by `apps/api` (HOS-2565 D8). */
    readonly resolveReasonLabel?: ReconciliationReasonLabelResolver;
}

/** Subject of the immediate unresolved-mark email. */
export const MARK_ESCALATED_SUBJECT = 'Marca de conciliación sin resolver';

/** Tells staff that a reconciliation mark passed its resolution deadline. */
export function MarkEscalated(props: MarkEscalatedProps) {
    const detail = describeSubject({
        context: props.context,
        subjectType: props.subjectType,
        subjectId: props.subjectId
    });
    return (
        <EmailLayout previewText={MARK_ESCALATED_SUBJECT}>
            <Heading>{MARK_ESCALATED_SUBJECT}</Heading>
            <Text>
                Una marca de conciliación de billing pasó su plazo sin que nadie la resolviera.
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
                    { label: 'Abierta el', value: formatDate({ dateString: props.placedAt }) },
                    { label: 'Escaló el', value: formatDate({ dateString: props.escalatedAt }) },
                    { label: 'Plazo', value: `${props.escalationDays} días` }
                ]}
            />
            <StaffNoticeAction
                action="Revisala y resolvela desde el listado accionable del panel de administración."
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
