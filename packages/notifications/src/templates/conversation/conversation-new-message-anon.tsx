import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Maximum number of message excerpts shown in the email */
const MAX_EXCERPTS = 3;
/** Maximum characters per excerpt before truncation */
const MAX_EXCERPT_LENGTH = 200;

/**
 * A single message excerpt included in the notification.
 */
export interface AnonMessageExcerpt {
    /** Message text, will be truncated to 200 chars if longer */
    excerpt: string;
    /** Human-readable timestamp for the message */
    timestamp: string;
}

/**
 * Props for ConversationNewMessageAnon email template.
 * Subject key: conversations.email.newMessageAnon.subject
 */
export interface ConversationNewMessageAnonProps {
    /** Name of the accommodation the conversation is about */
    accommodationName: string;
    /** Display name or email of the sender */
    guestIdentity: string;
    /**
     * Array of recent messages. Only the first 3 are rendered; excerpts longer
     * than 200 characters are truncated with an ellipsis.
     */
    messages: AnonMessageExcerpt[];
    /**
     * Token-based URL for accessing the conversation.
     * Format: /guest/messages/[token]
     */
    ctaUrl: string;
    /** Email locale — does not alter copy but included for caller parity */
    locale: 'es' | 'en' | 'pt';
}

/**
 * Email sent to an anonymous (token-based) guest to notify them of new messages.
 *
 * Unlike ConversationNewMessage, this variant:
 * - Uses the guest's token URL as the CTA (not a session-based URL).
 * - Includes an account-creation suggestion section to encourage registration.
 *
 * Renders up to 3 message excerpts, truncating any exceeding 200 characters.
 *
 * @param props - Template data
 */
export function ConversationNewMessageAnon({
    accommodationName,
    guestIdentity,
    messages,
    ctaUrl
}: ConversationNewMessageAnonProps) {
    const visibleMessages = messages.slice(0, MAX_EXCERPTS).map((m) => ({
        ...m,
        excerpt:
            m.excerpt.length > MAX_EXCERPT_LENGTH
                ? `${m.excerpt.slice(0, MAX_EXCERPT_LENGTH)}…`
                : m.excerpt
    }));

    return (
        <EmailLayout previewText={`Nueva respuesta sobre ${accommodationName} — Hospeda`}>
            <Heading>Hay una nueva respuesta a tu consulta</Heading>

            <Text style={styles.paragraph}>
                <strong>{guestIdentity}</strong> respondió sobre{' '}
                <strong>{accommodationName}</strong>.
            </Text>

            {visibleMessages.map((msg) => (
                <Section
                    key={msg.timestamp}
                    style={styles.excerptBox}
                >
                    <Text style={styles.timestamp}>{msg.timestamp}</Text>
                    <Text style={styles.excerptText}>{msg.excerpt}</Text>
                </Section>
            ))}

            <Section style={styles.buttonContainer}>
                <Button href={ctaUrl}>Ver mi conversación</Button>
            </Section>

            {/* Account-creation suggestion */}
            <Section style={styles.accountBox}>
                <Text style={styles.accountHeading}>¿Querés conservar tus conversaciones?</Text>
                <Text style={styles.accountText}>
                    Creá una cuenta gratuita en Hospeda para acceder a todas tus consultas desde un
                    solo lugar, sin necesidad de enlaces de acceso temporales.
                </Text>
                <Button
                    href={`${ctaUrl.split('/guest/')[0]}/es/registro`}
                    variant="secondary"
                >
                    Crear cuenta gratis
                </Button>
            </Section>

            <Text style={styles.footerNote}>
                Tu enlace de acceso es personal. No lo compartas con nadie.
            </Text>
        </EmailLayout>
    );
}

const styles = {
    paragraph: {
        color: '#475569',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px'
    },
    excerptBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #3b82f6',
        padding: '16px 20px',
        margin: '0 0 12px'
    },
    timestamp: {
        color: '#94a3b8',
        fontSize: '12px',
        lineHeight: '16px',
        margin: '0 0 6px'
    },
    excerptText: {
        color: '#334155',
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0'
    },
    buttonContainer: {
        margin: '32px 0',
        textAlign: 'center' as const
    },
    accountBox: {
        backgroundColor: '#f0fdf4',
        borderRadius: '8px',
        borderLeft: '4px solid #22c55e',
        padding: '20px 24px',
        margin: '24px 0',
        textAlign: 'center' as const
    },
    accountHeading: {
        color: '#15803d',
        fontSize: '15px',
        fontWeight: '600',
        lineHeight: '22px',
        margin: '0 0 8px'
    },
    accountText: {
        color: '#166534',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0 0 16px'
    },
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
