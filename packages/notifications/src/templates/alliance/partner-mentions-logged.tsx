import { Link, Section, Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/**
 * One logged promotion action, as this template renders it.
 *
 * Mirrors `PartnerMentionEntryPayload`. Declared locally rather than imported
 * from the types module for the same reason every other template in this
 * package declares its own props: a template's inputs are its contract.
 */
export interface PartnerMentionsLoggedEntry {
    /** Human label, resolved by the caller (e.g. "Instagram"). */
    readonly channelLabel: string;
    /** Link to the publication, when the channel produces one. */
    readonly url?: string | null;
}

/**
 * Props for the PartnerMentionsLogged email template (HOS-377 AC-9).
 */
export interface PartnerMentionsLoggedProps {
    /** Display name of the partner's contact. */
    readonly recipientName: string;
    /** Name of the partner listing that was promoted. */
    readonly partnerName: string;
    /** When the promotion happened, already formatted. */
    readonly mentionedAtLabel: string;
    /** Every channel in the submission. Never empty. */
    readonly mentions: readonly PartnerMentionsLoggedEntry[];
}

/**
 * Email sent once per logged promotion submission (AC-9).
 *
 * ## This is a record of actions, NOT a performance report (AC-3)
 *
 * The copy here is deliberately constrained, and the constraint is the point of
 * the whole feature. Hospeda logs what the team DID — a post, a newsletter
 * inclusion, a broadcast — and nothing about how it performed. So this template
 * may never say "alcance", "impresiones", "clics" or "estadísticas", nor imply
 * them with softer phrasing ("cuánta gente lo vio", "el impacto que tuvo").
 *
 * The reason is not stylistic. Hospeda does not measure any of that, and a
 * partner who reads "impacto" in an email will ask for the number behind it.
 * The honest promise is narrower and actually keepable: here is what we did,
 * and here is the link so you can go and see it yourself. A static copy guard
 * (T-030) enforces this across every string in the feature, including this one.
 *
 * ## Why a link per channel rather than one "ver más" button
 *
 * The link IS the verification. A single button to an account page would make
 * the partner take our word for it and then go hunting; a permalink per row
 * lets them click straight through to the post. Channels with no public
 * permalink (a WhatsApp broadcast, an "other" channel) render as a plain line,
 * because a dead link on an email whose promise is "go and check" is worse than
 * no link at all.
 *
 * @param props - Template data.
 */
export function PartnerMentionsLogged({
    recipientName,
    partnerName,
    mentionedAtLabel,
    mentions
}: PartnerMentionsLoggedProps) {
    const isSingle = mentions.length === 1;

    return (
        <EmailLayout
            previewText={`Difundimos ${partnerName} el ${mentionedAtLabel}`}
            showUnsubscribe={false}
        >
            <Heading>Difundimos tu ficha de aliado</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Te contamos que el <strong>{mentionedAtLabel}</strong> difundimos{' '}
                <strong>{partnerName}</strong>{' '}
                {isSingle ? 'en el siguiente canal' : 'en los siguientes canales'}:
            </Text>

            <Section style={styles.list}>
                {mentions.map((mention) => (
                    <Text
                        key={`${mention.channelLabel}-${mention.url ?? 'sin-enlace'}`}
                        style={styles.item}
                    >
                        <span style={styles.channel}>{mention.channelLabel}</span>
                        {mention.url ? (
                            <>
                                {' — '}
                                <Link
                                    href={mention.url}
                                    style={styles.link}
                                >
                                    ver la publicación
                                </Link>
                            </>
                        ) : null}
                    </Text>
                ))}
            </Section>

            <Text style={styles.paragraph}>
                Podés ver la bitácora completa de todo lo que difundimos desde tu cuenta, en la
                sección de aliados.
            </Text>

            <Text style={styles.footnote}>
                Esto es el registro de las acciones que hicimos, con el enlace a cada publicación
                para que puedas verificarlas.
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
    list: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #94a3b8',
        padding: '20px 24px',
        margin: '0 0 24px'
    },
    item: {
        color: '#334155',
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0 0 8px'
    },
    channel: {
        color: '#1e293b',
        fontWeight: 600
    },
    link: {
        color: '#0f766e',
        textDecoration: 'underline'
    },
    footnote: {
        color: '#64748b',
        fontSize: '13px',
        lineHeight: '20px',
        margin: '0'
    }
};
