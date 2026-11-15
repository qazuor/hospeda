import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/** Subject of the temporary courtesy revocation notice. */
export const COURTESY_REVOKED_SUBJECT = 'Tu cortesía terminó';

/** Announces the resumed subscription and its next charge date. */
export function CourtesyRevoked({ nextChargeOn }: { readonly nextChargeOn: string }) {
    return (
        <EmailLayout previewText={COURTESY_REVOKED_SUBJECT}>
            <Heading>{COURTESY_REVOKED_SUBJECT}</Heading>
            <Text>Tu cortesía terminó hoy y tu suscripción vuelve a estar activa.</Text>
            <Text>Tu próximo cobro es el {formatDate({ dateString: nextChargeOn })}.</Text>
        </EmailLayout>
    );
}
