import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/format-helpers.js';

/** Payload for an immediate notice that an unresolved reconciliation mark escalated. */
export interface MarkEscalatedProps {
    readonly markId: string;
    readonly subjectType: 'subscription' | 'addon_instance';
    readonly subjectId: string;
    readonly reason: string;
    readonly placedAt: string;
    readonly escalatedAt: string;
    readonly escalationDays: number;
}

/** Subject of the immediate unresolved-mark email. */
export const MARK_ESCALATED_SUBJECT = 'Marca de conciliación sin resolver';

/** Tells staff that a reconciliation mark passed its resolution deadline. */
export function MarkEscalated(props: MarkEscalatedProps) {
    return (
        <EmailLayout previewText={MARK_ESCALATED_SUBJECT}>
            <Heading>{MARK_ESCALATED_SUBJECT}</Heading>
            <Text>
                Una marca de conciliación de billing pasó su plazo de {props.escalationDays} días
                sin que nadie la resolviera. Motivo: {props.reason}. Sujeto: {props.subjectType}{' '}
                {props.subjectId}. Marca: {props.markId}. Abierta el{' '}
                {formatDate({ dateString: props.placedAt })}; escaló el{' '}
                {formatDate({ dateString: props.escalatedAt })}. Revisala en el listado accionable
                del panel de administración.
            </Text>
        </EmailLayout>
    );
}
