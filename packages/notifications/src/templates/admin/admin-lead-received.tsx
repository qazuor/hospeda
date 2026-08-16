import { Button, Hr, Section, Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for the AdminLeadReceived email template (H-62 / H-148).
 */
export interface AdminLeadReceivedProps {
    /** Which funnel it arrived through — "Comercios" or "Aliados". */
    readonly funnelLabel: string;
    /** The concrete program or domain applied for. */
    readonly programLabel: string;
    /** Who applied. */
    readonly contactName: string;
    /** Their email address. */
    readonly contactEmail: string;
    /** Their phone, when the form collected one. */
    readonly contactPhone?: string;
    /** The business name, when the funnel asks for one. */
    readonly businessName?: string;
    /** The applicant's message, verbatim. */
    readonly message?: string;
    /** Deep link to the admin queue where the lead is resolved. */
    readonly adminUrl: string;
    /** When it arrived, already formatted. */
    readonly submittedAtLabel: string;
}

/**
 * Operations alert sent the moment an acquisition lead arrives.
 *
 * ## Why it repeats the whole lead instead of linking to it
 *
 * Before this email existed, a lead was discoverable only by an operator
 * deciding, unprompted, to open the admin and look. Eleven applications sat in
 * `pending` for weeks that way, with no error, no bounce and no complaint —
 * nobody knew they had not been read. An alert that said only "there is a new
 * lead" would rebuild exactly that dependency, one click further along. So the
 * email carries what it takes to answer: who, for what, and how to reach them.
 *
 * ## Why the message is not truncated
 *
 * The four "aliados" forms fold their per-kind answers into the free-text
 * field — a `service_provider` states its benefit there and nowhere else.
 * Cutting it to a preview would drop the one thing that decides the outcome.
 *
 * ## Why there is no unsubscribe link
 *
 * It is an internal operations alert on the ADMIN channel, not a message to a
 * subscriber. Offering to unsubscribe from it would offer to restore the bug.
 *
 * @param props - Template data.
 */
export function AdminLeadReceived({
    funnelLabel,
    programLabel,
    contactName,
    contactEmail,
    contactPhone,
    businessName,
    message,
    adminUrl,
    submittedAtLabel
}: AdminLeadReceivedProps) {
    return (
        <EmailLayout
            previewText={`${programLabel} — ${contactName}`}
            showUnsubscribe={false}
        >
            <Heading>Nuevo lead de {programLabel}</Heading>

            <Text style={styles.paragraph}>
                Entró por el formulario de <strong>{funnelLabel}</strong> el {submittedAtLabel}.
            </Text>

            <Section style={styles.detailBox}>
                {businessName ? (
                    <Text style={styles.detail}>
                        <strong>Negocio:</strong> {businessName}
                    </Text>
                ) : null}
                <Text style={styles.detail}>
                    <strong>Contacto:</strong> {contactName}
                </Text>
                <Text style={styles.detail}>
                    <strong>Email:</strong> {contactEmail}
                </Text>
                {contactPhone ? (
                    <Text style={styles.detail}>
                        <strong>Teléfono:</strong> {contactPhone}
                    </Text>
                ) : null}
            </Section>

            {message ? (
                <>
                    <Hr style={styles.rule} />
                    <Text style={styles.messageLabel}>Lo que escribió:</Text>
                    <Text style={styles.message}>{message}</Text>
                </>
            ) : null}

            <Section style={styles.buttonWrapper}>
                <Button
                    href={adminUrl}
                    style={styles.button}
                >
                    Ver el lead en el panel
                </Button>
            </Section>
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
    detailBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #94a3b8',
        padding: '16px 20px',
        margin: '0 0 20px'
    },
    detail: {
        color: '#334155',
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0 0 6px'
    },
    rule: {
        borderColor: '#e2e8f0',
        margin: '0 0 16px'
    },
    messageLabel: {
        color: '#64748b',
        fontSize: '13px',
        lineHeight: '18px',
        margin: '0 0 6px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em'
    },
    message: {
        color: '#334155',
        fontSize: '15px',
        lineHeight: '23px',
        margin: '0 0 24px',
        whiteSpace: 'pre-wrap' as const
    },
    buttonWrapper: {
        margin: '0 0 8px'
    },
    button: {
        backgroundColor: '#0f766e',
        borderRadius: '8px',
        color: '#ffffff',
        display: 'inline-block',
        fontSize: '15px',
        fontWeight: 600,
        padding: '12px 22px',
        textDecoration: 'none'
    }
};
