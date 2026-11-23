import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';

/** Locales this notice is written in (owner decision, HOS-2192). */
export type ListingLocationExceptionLocale = 'es' | 'en' | 'pt';

/** Props of {@link ListingLocationExceptionDecision}. */
export interface ListingLocationExceptionDecisionProps {
    readonly recipientName: string;
    readonly locale: ListingLocationExceptionLocale;
    /** `true` for the approval, `false` for the rejection. */
    readonly approved: boolean;
    /** Name of the listing the request was about. */
    readonly listingName: string;
    /** The admin's reason. Shown on a rejection; never on an approval. */
    readonly decisionReason?: string;
    /** Absolute link to the listing's location editor. */
    readonly editorUrl: string;
}

/** Copy per locale. Kept here because this package does not use `@repo/i18n`. */
const COPY = {
    es: {
        approved: {
            subject: 'Aprobamos tu pedido de excepción de dirección',
            heading: 'Tu pedido fue aprobado',
            body: (listing: string) =>
                `Aprobamos la excepción de dirección de ${listing}. Ya podés publicar la ficha.`,
            cta: 'Ir a mi ficha'
        },
        rejected: {
            subject: 'Novedades sobre tu pedido de excepción de dirección',
            heading: 'No pudimos aprobar tu pedido',
            body: (listing: string) =>
                `No aprobamos la excepción de dirección de ${listing}. Cada local físico va en una sola ficha: sumale el rubro que falta en vez de crear otra.`,
            reasonLabel: 'Motivo del equipo:',
            cta: 'Ver mi ficha'
        },
        greeting: (name: string) => (name.trim() ? `Hola, ${name.trim()}:` : 'Hola:')
    },
    en: {
        approved: {
            subject: 'We approved your address exception request',
            heading: 'Your request was approved',
            body: (listing: string) =>
                `We approved the address exception for ${listing}. You can now publish the listing.`,
            cta: 'Go to my listing'
        },
        rejected: {
            subject: 'Update on your address exception request',
            heading: "We couldn't approve your request",
            body: (listing: string) =>
                `We did not approve the address exception for ${listing}. Each physical place goes in a single listing: add the missing business line instead of creating another one.`,
            reasonLabel: "The team's reason:",
            cta: 'See my listing'
        },
        greeting: (name: string) => (name.trim() ? `Hi ${name.trim()},` : 'Hi,')
    },
    pt: {
        approved: {
            subject: 'Aprovamos o seu pedido de exceção de endereço',
            heading: 'O seu pedido foi aprovado',
            body: (listing: string) =>
                `Aprovamos a exceção de endereço de ${listing}. Agora você já pode publicar o anúncio.`,
            cta: 'Ir para o meu anúncio'
        },
        rejected: {
            subject: 'Novidades sobre o seu pedido de exceção de endereço',
            heading: 'Não conseguimos aprovar o seu pedido',
            body: (listing: string) =>
                `Não aprovamos a exceção de endereço de ${listing}. Cada local físico vai em um único anúncio: adicione a categoria que falta em vez de criar outro.`,
            reasonLabel: 'Motivo da equipe:',
            cta: 'Ver o meu anúncio'
        },
        greeting: (name: string) => (name.trim() ? `Olá, ${name.trim()}:` : 'Olá:')
    }
} as const;

/**
 * Builds the localised subject of the decision notice.
 *
 * @param input - Locale and whether the request was approved.
 * @returns `{ subject }`.
 */
export function buildListingLocationExceptionSubject(input: {
    readonly locale: ListingLocationExceptionLocale;
    readonly approved: boolean;
}): { readonly subject: string } {
    const copy = COPY[input.locale];
    return { subject: (input.approved ? copy.approved : copy.rejected).subject };
}

/**
 * Email telling the owner how an admin resolved their location exception request
 * (HOS-2192). It carries the listing name and, on a rejection, the admin's reason.
 * It never carries the address or any other listing.
 *
 * @param props - Template data.
 */
export function ListingLocationExceptionDecision({
    recipientName,
    locale,
    approved,
    listingName,
    decisionReason,
    editorUrl
}: ListingLocationExceptionDecisionProps) {
    const copy = COPY[locale];
    const variant = approved ? copy.approved : copy.rejected;
    const reasonLabel = approved ? null : copy.rejected.reasonLabel;
    return (
        <EmailLayout previewText={variant.subject}>
            <Heading>{variant.heading}</Heading>
            <Text style={styles.paragraph}>{copy.greeting(recipientName)}</Text>
            <Text style={styles.paragraph}>{variant.body(listingName)}</Text>
            {reasonLabel && decisionReason ? (
                <Callout tone="info">
                    <Text style={styles.reasonLabel}>{reasonLabel}</Text>
                    <Text style={styles.reasonText}>{decisionReason}</Text>
                </Callout>
            ) : null}
            <Button href={editorUrl}>{variant.cta}</Button>
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
    reasonLabel: {
        fontSize: '13px',
        lineHeight: '18px',
        margin: '0 0 8px'
    },
    reasonText: {
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0'
    }
};
