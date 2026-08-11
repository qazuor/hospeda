import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for the ReviewReceived email template (HOS-376 §6.3).
 */
export interface ReviewReceivedProps {
    /** Display name of the provider's owner. */
    readonly recipientName: string;
    /** Their listing, named because a provider may have more than one. */
    readonly listingName: string;
    /** The overall star rating, 1-5. */
    readonly overallRating: number;
    /** Whether the host said the benefit was honoured. */
    readonly respectedBenefit: boolean;
    /** Where the provider can read it and answer. */
    readonly actionUrl: string;
}

/**
 * Email telling a provider they were reviewed.
 *
 * ## Why it carries the stars but not the text
 *
 * The rating is a fact about the provider's own listing and it is already
 * public. The written review is not summarised here on purpose: an excerpt in
 * an inbox is read as the whole thing, and the one case where that matters —
 * a complaint the provider wants to answer — is exactly the case where a
 * truncated quote would provoke a reply to something the host did not say.
 * The link goes where the full text and the answer box live together.
 *
 * ## Why `respectedBenefit` gets its own line
 *
 * It is the answer the directory exists to collect (§6.3): a provider listed
 * *because* of a benefit who did not honour it is the failure mode this system
 * has to surface. Folded into the stars it would disappear.
 *
 * @param props - Template data.
 */
export function ReviewReceived({
    recipientName,
    listingName,
    overallRating,
    respectedBenefit,
    actionUrl
}: ReviewReceivedProps) {
    return (
        <EmailLayout
            previewText={`Recibiste una valoración en ${listingName}`}
            showUnsubscribe={false}
        >
            <Heading>Te dejaron una valoración</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Un anfitrión valoró <strong>{listingName}</strong> con{' '}
                <strong>{overallRating} de 5</strong>.
            </Text>

            <Section style={styles.benefitBox}>
                <Text style={styles.benefitText}>
                    {respectedBenefit
                        ? 'Confirmó que respetaste el beneficio acordado.'
                        : 'Marcó que no se respetó el beneficio acordado.'}
                </Text>
            </Section>

            <Text style={styles.paragraph}>
                Podés leerla completa y responderla desde tu panel. Tu respuesta pasa por una
                revisión rápida antes de publicarse.
            </Text>

            <Section style={styles.actions}>
                <Button href={actionUrl}>Ver la valoración</Button>
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
    benefitBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #94a3b8',
        padding: '16px 24px',
        margin: '0 0 24px'
    },
    benefitText: {
        color: '#334155',
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0'
    },
    actions: {
        margin: '0 0 24px'
    }
};
