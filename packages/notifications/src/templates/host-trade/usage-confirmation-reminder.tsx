import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for the UsageConfirmationReminder email template (HOS-376 AC-8).
 */
export interface UsageConfirmationReminderProps {
    /** Display name of whoever has to answer. */
    readonly recipientName: string;
    /** The other party. */
    readonly counterpartName: string;
    /** When the record expires if nobody answers, already formatted. */
    readonly expiresAtLabel: string;
    /** Where to go to answer. */
    readonly actionUrl: string;
}

/**
 * The single nudge sent on day 10, for a usage still waiting (AC-8).
 *
 * ONE REMINDER, NOT A SEQUENCE. The record expires on its own at thirty days
 * and expiring is a perfectly good outcome — silence is not an accusation
 * (§6.6). A second and third chase would turn a neutral timeout into pressure
 * to confirm something the recipient may simply not remember, which is exactly
 * the confirmation this system must not manufacture.
 *
 * Its idempotency lives in the database, not here: the cron stamps
 * `reminderSentAt` and skips anything already stamped.
 *
 * @param props - Template data.
 */
export function UsageConfirmationReminder({
    recipientName,
    counterpartName,
    expiresAtLabel,
    actionUrl
}: UsageConfirmationReminderProps) {
    return (
        <EmailLayout
            previewText={`Sigue pendiente el uso del beneficio con ${counterpartName}`}
            showUnsubscribe={false}
        >
            <Heading>Te quedó algo pendiente</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Hace unos días <strong>{counterpartName}</strong> registró un uso del beneficio y
                todavía no nos dijiste si estuvo bien.
            </Text>

            <Section style={styles.actions}>
                <Button href={actionUrl}>Confirmar o rechazar</Button>
            </Section>

            <Text style={styles.footnote}>
                Es el único recordatorio que te mandamos. Si preferís no hacer nada, el registro
                vence solo el {expiresAtLabel}.
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
    actions: {
        margin: '0 0 24px'
    },
    footnote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0'
    }
};
