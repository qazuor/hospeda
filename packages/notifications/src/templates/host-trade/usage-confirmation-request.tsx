import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for the UsageConfirmationRequest email template (HOS-376 §6.6).
 */
export interface UsageConfirmationRequestProps {
    /** Display name of whoever has to answer. */
    readonly recipientName: string;
    /** The other party: the provider's listing, or the host's name. */
    readonly counterpartName: string;
    /** The date the work is claimed to have happened, already formatted. */
    readonly servicedAtLabel: string;
    /** When the record expires if nobody answers, already formatted. */
    readonly expiresAtLabel: string;
    /** Where to go to answer. */
    readonly actionUrl: string;
}

/**
 * Email asking the counterpart to confirm a declared benefit usage.
 *
 * THE WHOLE CHAIN HANGS OFF THIS ONE (§6.6). A usage nobody confirms cannot
 * become a review, cannot move the public counters, and expires in silence —
 * so if this email does not land or does not get read, the feature does not
 * exist. That is why it says plainly what happens if it is ignored: the
 * alternative is a recipient who assumes it will resolve itself.
 *
 * ## Why it does not accuse
 *
 * The copy never suggests the other party is lying. Most unanswered records are
 * simply forgotten, and a first contact written as a dispute would make
 * confirming feel like conceding something. Rejecting has to stay as cheap as
 * confirming (§6.5), which starts here.
 *
 * @param props - Template data.
 */
export function UsageConfirmationRequest({
    recipientName,
    counterpartName,
    servicedAtLabel,
    expiresAtLabel,
    actionUrl
}: UsageConfirmationRequestProps) {
    return (
        <EmailLayout
            previewText={`${counterpartName} registró un uso del beneficio y necesita tu confirmación`}
            showUnsubscribe={false}
        >
            <Heading>¿Nos confirmás que esto pasó?</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                <strong>{counterpartName}</strong> registró que usaron el beneficio del directorio
                de Hospeda el <strong>{servicedAtLabel}</strong>. Nos falta tu confirmación para
                darlo por hecho.
            </Text>

            <Section style={styles.actions}>
                <Button href={actionUrl}>Confirmar o rechazar</Button>
            </Section>

            <Text style={styles.paragraph}>
                Si no fue así, rechazalo sin vueltas: no le pasa nada malo a nadie por eso, y es lo
                que mantiene honestos los números que ven los demás anfitriones.
            </Text>

            <Text style={styles.footnote}>
                Si no respondés, el registro vence solo el {expiresAtLabel} y no cuenta para nada.
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
    actions: {
        margin: '0 0 24px'
    },
    footnote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0'
    }
};
