import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for the UsageConfirmed email template (HOS-376 §6.6).
 */
export interface UsageConfirmedProps {
    /** Display name of whoever declared the usage. */
    readonly recipientName: string;
    /** The party who confirmed it. */
    readonly counterpartName: string;
    /** Whether the recipient may now review the provider. */
    readonly canReview: boolean;
    /** Where the review form lives. Only meaningful when `canReview`. */
    readonly reviewUrl?: string;
}

/**
 * Email telling the declarant their usage was confirmed.
 *
 * ## Why the review invitation is conditional
 *
 * A confirmed usage unlocks reviewing ONLY for the host: a provider cannot
 * review himself, and a host reviewing is the whole point of the chain. Sending
 * every declarant an invitation to "contar cómo te fue" would invite half of
 * them to a form that will refuse them, which is the kind of copy that promises
 * behaviour the software does not have.
 *
 * @param props - Template data.
 */
export function UsageConfirmed({
    recipientName,
    counterpartName,
    canReview,
    reviewUrl
}: UsageConfirmedProps) {
    return (
        <EmailLayout
            previewText={`${counterpartName} confirmó el uso del beneficio`}
            showUnsubscribe={false}
        >
            <Heading>Quedó confirmado</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                <strong>{counterpartName}</strong> confirmó el uso del beneficio que registraste. Ya
                cuenta para los números que ven los anfitriones en el directorio.
            </Text>

            {canReview && reviewUrl ? (
                <>
                    <Text style={styles.paragraph}>
                        Ahora podés contar cómo te fue. Lo que escribas se publica en la ficha y
                        ayuda al que viene atrás tuyo a decidir.
                    </Text>
                    <Section style={styles.actions}>
                        <Button href={reviewUrl}>Dejar una valoración</Button>
                    </Section>
                </>
            ) : null}
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
    actions: {
        margin: '0 0 24px'
    }
};
