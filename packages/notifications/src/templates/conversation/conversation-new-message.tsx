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
export interface MessageExcerpt {
    /** Message text, will be truncated to 200 chars if longer */
    excerpt: string;
    /** Human-readable timestamp for the message */
    timestamp: string;
}

/**
 * Props for ConversationNewMessage email template.
 * Subject key: conversations.email.newMessage.subject
 */
export interface ConversationNewMessageProps {
    /** Name of the accommodation the conversation is about */
    accommodationName: string;
    /** Display name or email of the sender (guest or owner) */
    guestIdentity: string;
    /**
     * Array of recent messages. Only the first 3 are rendered; excerpts longer
     * than 200 characters are truncated with an ellipsis.
     */
    messages: MessageExcerpt[];
    /** URL for the primary CTA button (conversation thread) */
    ctaUrl: string;
    /** Email locale — does not alter copy but included for caller parity */
    locale: 'es' | 'en' | 'pt';
}

/**
 * Email sent to notify a registered guest or owner that they have new messages
 * in a conversation thread.
 *
 * Renders up to 3 message excerpts, truncating any that exceed 200 characters.
 *
 * @param props - Template data
 */
export function ConversationNewMessage({
    accommodationName,
    guestIdentity,
    messages,
    ctaUrl
}: ConversationNewMessageProps) {
    const visibleMessages = messages.slice(0, MAX_EXCERPTS).map((m) => ({
        ...m,
        excerpt:
            m.excerpt.length > MAX_EXCERPT_LENGTH
                ? `${m.excerpt.slice(0, MAX_EXCERPT_LENGTH)}…`
                : m.excerpt
    }));

    return (
        <EmailLayout previewText={`Nuevo mensaje de ${guestIdentity} sobre ${accommodationName}`}>
            <Heading>Tenés nuevos mensajes</Heading>

            <Text style={styles.paragraph}>
                <strong>{guestIdentity}</strong> te escribió sobre{' '}
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
                <Button href={ctaUrl}>Ver conversación</Button>
            </Section>

            <Text style={styles.footerNote}>
                Respondé directamente desde la plataforma para mantener el historial completo.
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
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
