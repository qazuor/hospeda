import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject of the third-party business-lines change notice (HOS-1875). */
export const LISTING_BUSINESS_LINES_CHANGED_SUBJECT = 'Soporte cambió los rubros de tu ficha';

/**
 * Joins labels the way the Spanish templates read them: commas and a final
 * «y». Kept local on purpose — the neighbouring vertical templates do not use
 * `Intl.ListFormat`.
 */
function joinLabels(labels: readonly string[]): string {
    if (labels.length <= 1) return labels[0] ?? '';
    return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
}

/**
 * Action 27 transition: the owner is told which business lines a third party
 * added or removed and which sections appear or stop being visible (HOS-1875,
 * DEC-FAC-034). The labels arrive already translated by service-core, in the
 * owner's web locale, so this template carries no business-line literal.
 */
export function ListingBusinessLinesChanged({
    listingName,
    changedDate,
    addedLines,
    removedLines,
    shownSections,
    hiddenSections,
    accountUrl,
    contactUrl
}: {
    readonly listingName: string;
    readonly changedDate: string;
    readonly addedLines: readonly string[];
    readonly removedLines: readonly string[];
    readonly shownSections: readonly string[];
    readonly hiddenSections: readonly string[];
    readonly accountUrl: string;
    readonly contactUrl: string;
}) {
    return (
        <EmailLayout previewText={LISTING_BUSINESS_LINES_CHANGED_SUBJECT}>
            <Heading>{LISTING_BUSINESS_LINES_CHANGED_SUBJECT}</Heading>
            <Text>
                Soporte cambió los rubros de tu ficha {listingName} el {changedDate}.
            </Text>
            {addedLines.length > 0 && <Text>Agregó: {joinLabels(addedLines)}.</Text>}
            {removedLines.length > 0 && <Text>Quitó: {joinLabels(removedLines)}.</Text>}
            {shownSections.length > 0 && (
                <Text>Ahora se ven en tu ficha: {joinLabels(shownSections)}.</Text>
            )}
            {hiddenSections.length > 0 && (
                <Text>Dejan de verse: {joinLabels(hiddenSections)}.</Text>
            )}
            <Text>
                No se borró nada: lo que cargaste en una sección oculta vuelve si recuperás el
                rubro.
            </Text>
            <Text>Mirá tu ficha en Mi Cuenta: {accountUrl}</Text>
            <Text>Si no lo pediste, escribinos: {contactUrl}</Text>
        </EmailLayout>
    );
}
