import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for the AllianceClaimInvite email template (HOS-278 §6.2).
 */
export interface AllianceClaimInviteProps {
    /** Display name of the ACCOUNT OWNER — not necessarily the applicant. */
    readonly recipientName: string;
    /** Human-readable program name (e.g. "Partner", "Proveedor"). */
    readonly programLabel: string;
    /** Full confirmation URL including the single-use claim token. */
    readonly claimUrl: string;
    /** When the link stops working, already formatted for display. */
    readonly expiresAtLabel: string;
}

/**
 * Email sent to the OWNER of an email address that an anonymous "aliados"
 * application arrived with (HOS-278 §6.2, AC-4).
 *
 * The copy is written for someone who may NOT have applied. That is the whole
 * point of the message: the lead's email is unverified, so until this button is
 * clicked the application hangs off nobody, and the recipient's account is
 * untouched. Two consequences for the wording:
 *
 * - It never says "your application" — it asks whether the application is
 *   theirs, and states plainly that doing nothing is a safe, complete answer.
 * - It does not reveal any detail the applicant typed (their message, phone, or
 *   the fact that a specific person applied). A stranger could have typed this
 *   address; the recipient learns only that SOMETHING was submitted with it.
 *
 * @param props - Template data.
 */
export function AllianceClaimInvite({
    recipientName,
    programLabel,
    claimUrl,
    expiresAtLabel
}: AllianceClaimInviteProps) {
    return (
        <EmailLayout
            previewText="Recibimos una postulación con tu email — confirmá si fuiste vos"
            showUnsubscribe={false}
        >
            <Heading>¿Fuiste vos?</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Alguien envió una postulación al programa de <strong>{programLabel}</strong> de
                Hospeda usando este email. Como la postulación llegó sin sesión iniciada,{' '}
                <strong>no la vinculamos a tu cuenta</strong>: queremos que lo confirmes vos.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={claimUrl}>Sí, la postulación es mía</Button>
            </Section>

            <Text style={styles.paragraph}>
                El enlace vence el <strong>{expiresAtLabel}</strong> y se puede usar una sola vez.
            </Text>

            <Section style={styles.noteBox}>
                <Text style={styles.noteText}>
                    <strong>Si no fuiste vos, no hagas nada.</strong> Tu cuenta no cambió y no va a
                    cambiar: sin ese clic, la postulación queda sin vincular. No hace falta que nos
                    escribas.
                </Text>
            </Section>

            <Text style={styles.securityNote}>
                ¿Dudas? Escribinos a soporte@hospeda.com.ar respondiendo este mismo email.
            </Text>
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
    buttonContainer: {
        margin: '32px 0',
        textAlign: 'center' as const
    },
    noteBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #94a3b8',
        padding: '20px 24px',
        margin: '24px 0'
    },
    noteText: {
        color: '#334155',
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0'
    },
    securityNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
