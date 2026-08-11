import { Section, Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for the UsageRejected email template (HOS-376 §6.5).
 */
export interface UsageRejectedProps {
    /** Display name of whoever declared the usage. */
    readonly recipientName: string;
    /** The party who rejected it. */
    readonly counterpartName: string;
    /** The note they left, when they left one. */
    readonly note?: string;
}

/**
 * Email telling the declarant their usage was rejected.
 *
 * ## Why this is written flat, with no appeal button
 *
 * A rejection blocks that side from re-declaring on the pair, and enough of
 * them suspend the provider's ability to declare at all (§6.5) — so this is a
 * consequential message. It is still written as information rather than as an
 * accusation, because the control only stays usable if rejecting is cheap and
 * ordinary. Dramatising it here would make the next host hesitate.
 *
 * There is no "disputar" link because there is no dispute flow. Whoever
 * rejected can undo it themselves, and that is the only reversal that exists;
 * pointing at a button that is not there would be worse than pointing at
 * nothing.
 *
 * @param props - Template data.
 */
export function UsageRejected({ recipientName, counterpartName, note }: UsageRejectedProps) {
    return (
        <EmailLayout
            previewText={`${counterpartName} no reconoció el uso del beneficio`}
            showUnsubscribe={false}
        >
            <Heading>No quedó registrado</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                <strong>{counterpartName}</strong> nos dijo que el uso del beneficio que registraste
                no ocurrió, así que no lo vamos a contar.
            </Text>

            {note ? (
                <Section style={styles.noteBox}>
                    <Text style={styles.noteLabel}>Nos dejaron esta nota:</Text>
                    <Text style={styles.noteText}>{note}</Text>
                </Section>
            ) : null}

            <Text style={styles.paragraph}>
                Si te parece que hubo una confusión, lo más rápido es hablarlo directamente. Si se
                aclara, quien lo rechazó puede volver atrás desde su cuenta.
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
    noteBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #94a3b8',
        padding: '20px 24px',
        margin: '0 0 24px'
    },
    noteLabel: {
        color: '#64748b',
        fontSize: '13px',
        lineHeight: '18px',
        margin: '0 0 8px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.04em'
    },
    noteText: {
        color: '#334155',
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0'
    }
};
