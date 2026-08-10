import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for the ReplyModerated email template (HOS-376 AC-24).
 */
export interface ReplyModeratedProps {
    /** Display name of the provider's owner. */
    readonly recipientName: string;
    /** How it was resolved. */
    readonly outcome: 'approved' | 'rejected';
    /** The moderator's reason. Present when it was rejected. */
    readonly reason?: string;
    /** Where the provider can see or rewrite it. */
    readonly actionUrl: string;
}

/**
 * Email telling a provider whether their reply was published (AC-24).
 *
 * ## Why the reason travels by email and not in the panel
 *
 * `HostTradeReviewReplyProtectedSchema` deliberately leaves the moderator's
 * reason out of what the provider's panel serves, so THIS is the only place a
 * rejected provider learns why. Dropping it here would leave him with a reply
 * that silently never appeared and no way to write a better one — the failure
 * the whole moderation step exists to avoid.
 *
 * ## Why a rejection is not the end
 *
 * Editing a reply returns it to the queue, so a rejected provider can rewrite
 * and try again. The copy says so, because the alternative reading — that he
 * lost his one chance to answer a complaint — is both wrong and the one a
 * worried person reaches for.
 *
 * @param props - Template data.
 */
export function ReplyModerated({ recipientName, outcome, reason, actionUrl }: ReplyModeratedProps) {
    const approved = outcome === 'approved';

    return (
        <EmailLayout
            previewText={
                approved ? 'Tu respuesta ya está publicada' : 'Tu respuesta necesita un ajuste'
            }
            showUnsubscribe={false}
        >
            <Heading>{approved ? 'Tu respuesta ya se ve' : 'Sobre tu respuesta'}</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            {approved ? (
                <Text style={styles.paragraph}>
                    Revisamos tu respuesta y ya aparece publicada debajo de la valoración, para
                    cualquier anfitrión que la lea.
                </Text>
            ) : (
                <Text style={styles.paragraph}>
                    Revisamos tu respuesta y por ahora no la publicamos.
                </Text>
            )}

            {!approved && reason ? (
                <Section style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>El motivo fue:</Text>
                    <Text style={styles.reasonText}>{reason}</Text>
                </Section>
            ) : null}

            {approved ? null : (
                <Text style={styles.paragraph}>
                    Podés editarla y la revisamos de nuevo. No perdiste la posibilidad de responder.
                </Text>
            )}

            <Section style={styles.actions}>
                <Button href={actionUrl}>
                    {approved ? 'Ver la respuesta' : 'Editar la respuesta'}
                </Button>
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
    reasonBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #94a3b8',
        padding: '20px 24px',
        margin: '0 0 24px'
    },
    reasonLabel: {
        color: '#64748b',
        fontSize: '13px',
        lineHeight: '18px',
        margin: '0 0 8px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.04em'
    },
    reasonText: {
        color: '#334155',
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0'
    },
    actions: {
        margin: '0 0 24px'
    }
};
