import { Section, Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for the HostTradeRevoked email template (HOS-278 R-4).
 */
export interface HostTradeRevokedProps {
    /** Display name of the provider. */
    readonly recipientName: string;
    /** Name of the listing that was taken down. */
    readonly listingName: string;
    /** Why it was revoked, shown verbatim. */
    readonly reason: string;
}

/**
 * Email sent when an admin revokes a provider's directory listing (R-4).
 *
 * ## Why the reason is quoted, when the rejection email refuses to
 *
 * `AllianceLeadDecision` deliberately withholds the admin's note, because that
 * note is an internal assessment written for colleagues. This is the opposite
 * case: the revoke endpoint REQUIRES a reason precisely so the provider can be
 * told, and an explanation nobody reads is the audit gap R-4 exists to close.
 * Withholding it here would leave the provider guessing why they vanished from
 * a directory they were invited into.
 *
 * ## Why it does not promise an appeal
 *
 * There is no reinstatement flow — R-4 chose "revoke, not undo", and the row
 * survives for auditing, not as a queue an admin works through. The copy
 * therefore points at the support address rather than at a button that does
 * not exist. Copy must never promise behaviour the software does not have.
 *
 * @param props - Template data.
 */
export function HostTradeRevoked({ recipientName, listingName, reason }: HostTradeRevokedProps) {
    return (
        <EmailLayout
            previewText={`Tu ficha ${listingName} ya no aparece en el directorio de Hospeda`}
            showUnsubscribe={false}
        >
            <Heading>Sobre tu ficha en el directorio</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Te escribimos para contarte que <strong>{listingName}</strong> dejó de aparecer en
                el directorio de proveedores de Hospeda. Los anfitriones ya no la ven.
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
