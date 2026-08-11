import { Section, Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for the AllianceLeadDecision email template (HOS-278 AC-6).
 */
export interface AllianceLeadDecisionProps {
    /** Display name of the applicant. */
    readonly recipientName: string;
    /** Human-readable program name (e.g. "Partner", "Proveedor"). */
    readonly programLabel: string;
    /** Which way the admin resolved the application. */
    readonly outcome: 'approved' | 'rejected';
}

/**
 * Email sent when an admin resolves an "aliados" application (HOS-278 AC-6).
 *
 * ## Why the approval copy says so little
 *
 * It stops at "we approved it, we will write to you with the next step" and
 * links nowhere. That is deliberate, not a placeholder: what happens after
 * approval is built per program in later slices (C — proveedor, D — partner,
 * E — editor), and today an admin still provisions by hand. Promising a panel
 * to log into, or a form to complete, would be copy describing software that
 * does not exist yet — and the applicant would go looking for it.
 *
 * When a slice lands, its onboarding step belongs HERE, not in a second email.
 *
 * ## Why the rejection is short
 *
 * It does not paraphrase the admin's note. That note is internal, written for
 * colleagues rather than for the applicant, and forwarding it would publish
 * candid internal assessments to the person being assessed. A rejection that
 * says less is kinder than one that says the wrong thing.
 *
 * @param props - Template data.
 */
export function AllianceLeadDecision({
    recipientName,
    programLabel,
    outcome
}: AllianceLeadDecisionProps) {
    const approved = outcome === 'approved';

    return (
        <EmailLayout
            previewText={
                approved
                    ? 'Aprobamos tu postulación en Hospeda'
                    : 'Novedades sobre tu postulación en Hospeda'
            }
            showUnsubscribe={false}
        >
            <Heading>{approved ? '¡Buenas noticias!' : 'Sobre tu postulación'}</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            {approved ? (
                <>
                    <Text style={styles.paragraph}>
                        Revisamos tu postulación al programa de <strong>{programLabel}</strong> de
                        Hospeda y <strong>la aprobamos</strong>. Gracias por querer sumarte.
                    </Text>
                    <Text style={styles.paragraph}>
                        En los próximos días te vamos a escribir a este mismo correo para coordinar
                        el siguiente paso.
                    </Text>
                </>
            ) : (
                <>
                    <Text style={styles.paragraph}>
                        Revisamos tu postulación al programa de <strong>{programLabel}</strong> de
                        Hospeda y, por ahora, <strong>no vamos a avanzar</strong>.
                    </Text>
                    <Text style={styles.paragraph}>
                        Gracias por el tiempo que te tomaste en escribirnos. Si más adelante cambia
                        algo de tu propuesta, podés volver a postularte cuando quieras.
                    </Text>
                </>
            )}

            <Section style={styles.noteBox}>
                <Text style={styles.noteText}>
                    ¿Tenés alguna consulta? Respondé este email o escribinos a
                    soporte@hospeda.com.ar.
                </Text>
            </Section>
        </EmailLayout>
    );
}

const styles = {
    greeting: {
        color: '#1e293b',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px'
    },
    paragraph: {
        color: '#475569',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px'
    },
    noteBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #94a3b8',
        padding: '20px 24px',
        margin: '24px 0 0'
    },
    noteText: {
        color: '#334155',
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0'
    }
};
