import { Section, Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for the PartnerRevoked email template (HOS-278 R-4).
 */
export interface PartnerRevokedProps {
    /** Display name of the partner's owner. */
    readonly recipientName: string;
    /** Name of the partner listing that was taken down. */
    readonly partnerName: string;
    /** Why it was revoked, shown verbatim. */
    readonly reason: string;
}

/**
 * Email sent when an admin revokes a partner listing (R-4).
 *
 * A sibling of {@link HostTradeRevoked} rather than a shared template: the two
 * programs are different arrangements and the copy has to say so. A provider
 * hears "you left the provider directory"; a partner hears "you left the
 * alliance surfaces you were paying for", which is a different fact with a
 * different consequence.
 *
 * ## Why the reason is quoted, when the rejection email refuses to
 *
 * `AllianceLeadDecision` deliberately withholds the admin's note, because that
 * note is an internal assessment written for colleagues. This is the opposite
 * case: the revoke endpoint REQUIRES a reason precisely so the partner can be
 * told, and an explanation nobody reads is the audit gap R-4 exists to close.
 *
 * ## Why it says nothing about money
 *
 * Revoking flips `lifecycleState`, never `subscriptionStatus` — the two are
 * deliberately separate, so a revoked partner's billing state is whatever it
 * already was and this email is not the place to guess at it. Promising a
 * refund the software does not issue is exactly the R-5 failure mode.
 *
 * @param props - Template data.
 */
export function PartnerRevoked({ recipientName, partnerName, reason }: PartnerRevokedProps) {
    return (
        <EmailLayout
            previewText={`${partnerName} ya no aparece entre los aliados de Hospeda`}
            showUnsubscribe={false}
        >
            <Heading>Sobre tu ficha de aliado</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Te escribimos para contarte que <strong>{partnerName}</strong> dejó de aparecer
                entre los aliados de Hospeda. Ya no se ve en el sitio.
            </Text>

            <Section style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>El motivo que registramos fue:</Text>
                <Text style={styles.reasonText}>{reason}</Text>
            </Section>

            <Text style={styles.paragraph}>
                Si creés que hubo un error o querés conversarlo, respondé este email o escribinos a
                soporte@hospeda.com.ar.
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
    }
};
