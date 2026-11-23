import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { formatCalendarDate, formatCalendarDateRange } from '@repo/utils';
import { Heading } from '../components/heading.js';

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
 * Booking context the guest attached to the inquiry (HOS-2534). Every field is
 * optional; the template renders the block only when at least one is present.
 */
export interface ConversationInquiryDetails {
    /** Check-in calendar date (`YYYY-MM-DD`) */
    checkIn?: string | null;
    /** Check-out calendar date (`YYYY-MM-DD`) */
    checkOut?: string | null;
    /** Number of guests */
    guests?: number | null;
}

/**
 * Builds the one-line inquiry summary (`12–15 dic · 2 huéspedes`). The email
 * copy is Spanish-only, like the rest of this template.
 *
 * @param inquiry - The optional booking fields
 * @returns The summary, or `null` when there is nothing to show
 */
export function formatInquiryDetails(inquiry: ConversationInquiryDetails | undefined) {
    if (!inquiry) return null;
    const { checkIn, checkOut, guests } = inquiry;
    const parts: string[] = [];
    if (checkIn && checkOut) {
        const range = formatCalendarDateRange({ from: checkIn, to: checkOut, locale: 'es' });
        if (range) parts.push(range);
    } else if (checkIn || checkOut) {
        const date = formatCalendarDate({
            value: (checkIn ?? checkOut) as string,
            locale: 'es',
            options: { day: 'numeric', month: 'short' }
        });
        if (date) parts.push(`${checkIn ? 'Desde el' : 'Hasta el'} ${date}`);
    }
    if (typeof guests === 'number' && guests > 0) {
        parts.push(guests === 1 ? '1 huésped' : `${guests} huéspedes`);
    }
    return parts.length > 0 ? parts.join(' \u00b7 ') : null;
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
    /** Dates and guests the guest asked about; omitted when the inquiry carried none */
    inquiry?: ConversationInquiryDetails;
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
    ctaUrl,
    inquiry
}: ConversationNewMessageProps) {
    const inquirySummary = formatInquiryDetails(inquiry);
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

            {inquirySummary && (
                <Text style={styles.inquiry}>
                    <strong>Consulta:</strong> {inquirySummary}
                </Text>
            )}

            {visibleMessages.map((msg) => (
                <Callout
                    key={msg.timestamp}
                    tone="info"
                >
                    <Text style={styles.timestamp}>{msg.timestamp}</Text>
                    <Text style={styles.excerptText}>{msg.excerpt}</Text>
                </Callout>
            ))}

            <Button href={ctaUrl}>Ver conversación</Button>

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
    inquiry: {
        color: '#334155',
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0 0 16px'
    },
    timestamp: {
        fontSize: '12px',
        lineHeight: '16px',
        margin: '0 0 6px'
    },
    excerptText: {
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0'
    },
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
