import { Link, Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Locales this digest is written in (owner decision, HOS-2101). */
export type AiQuestionsDigestLocale = 'es' | 'en' | 'pt';

/** One listing as the digest renders it. */
export interface AiQuestionsDigestListing {
    /** Display name of the listing. */
    readonly listingName: string;
    /** Unanswered questions on the listing during the week. */
    readonly unansweredCount: number;
    /** Up to five of those questions. */
    readonly questions: readonly string[];
    /** Link to the listing's «Preguntas a la IA» tab. */
    readonly panelUrl: string;
}

/** Props of {@link AiQuestionsWeeklyDigest}. */
export interface AiQuestionsWeeklyDigestProps {
    readonly recipientName: string;
    readonly locale: AiQuestionsDigestLocale;
    /** Never empty: the cron sends nothing when no listing qualifies. */
    readonly listings: readonly AiQuestionsDigestListing[];
    /** Account preferences page, where the digest can be switched off. */
    readonly preferencesUrl: string;
}

/** Copy per locale. Kept here because this package does not use `@repo/i18n`. */
const COPY = {
    es: {
        preview: 'Preguntas que el chat de IA no pudo responder esta semana',
        heading: 'Preguntas sin responder de la semana',
        greeting: (name: string) => (name.trim() ? `Hola, ${name.trim()}:` : 'Hola:'),
        intro: 'Estas preguntas llegaron al chat de IA de tus fichas y el dato no estaba en la ficha. Si lo agregás, el chat lo va a poder responder.',
        count: (n: number) =>
            n === 1 ? '1 pregunta sin responder' : `${n} preguntas sin responder`,
        more: (n: number) => (n === 1 ? 'y 1 más' : `y ${n} más`),
        cta: 'Ver las preguntas',
        optOut: 'No querés recibir este resumen?',
        optOutLink: 'Desactivalo desde tus preferencias'
    },
    en: {
        preview: 'Questions the AI chat could not answer this week',
        heading: "This week's unanswered questions",
        greeting: (name: string) => (name.trim() ? `Hi ${name.trim()},` : 'Hi,'),
        intro: 'These questions reached the AI chat of your listings and the answer was not in the listing. If you add it, the chat will be able to answer.',
        count: (n: number) => (n === 1 ? '1 unanswered question' : `${n} unanswered questions`),
        more: (n: number) => `and ${n} more`,
        cta: 'See the questions',
        optOut: "Don't want this summary?",
        optOutLink: 'Turn it off in your preferences'
    },
    pt: {
        preview: 'Perguntas que o chat de IA não conseguiu responder nesta semana',
        heading: 'Perguntas sem resposta da semana',
        greeting: (name: string) => (name.trim() ? `Olá, ${name.trim()}:` : 'Olá:'),
        intro: 'Estas perguntas chegaram ao chat de IA dos seus anúncios e a informação não estava no anúncio. Se você adicioná-la, o chat poderá responder.',
        count: (n: number) => (n === 1 ? '1 pergunta sem resposta' : `${n} perguntas sem resposta`),
        more: (n: number) => (n === 1 ? 'e mais 1' : `e mais ${n}`),
        cta: 'Ver as perguntas',
        optOut: 'Não quer receber este resumo?',
        optOutLink: 'Desative nas suas preferências'
    }
} as const;

/** Subject per locale. */
const SUBJECT = {
    es: (n: number) =>
        n === 1
            ? 'Tu chat de IA no pudo responder 1 pregunta esta semana'
            : `Tu chat de IA no pudo responder ${n} preguntas esta semana`,
    en: (n: number) =>
        n === 1
            ? 'Your AI chat could not answer 1 question this week'
            : `Your AI chat could not answer ${n} questions this week`,
    pt: (n: number) =>
        n === 1
            ? 'Seu chat de IA não conseguiu responder 1 pergunta nesta semana'
            : `Seu chat de IA não conseguiu responder ${n} perguntas nesta semana`
} as const;

/**
 * Builds the localised subject of the digest.
 *
 * @param input - Locale and the total unanswered count across listings.
 * @returns `{ subject }`.
 */
export function buildAiQuestionsDigestSubject(input: {
    readonly locale: AiQuestionsDigestLocale;
    readonly totalUnanswered: number;
}): { readonly subject: string } {
    return { subject: SUBJECT[input.locale](input.totalUnanswered) };
}

/**
 * Weekly digest of the AI chat questions an owner's listings could not answer
 * (HOS-2101). Anonymous: it shows questions, never who asked.
 *
 * @param props - Template data.
 */
export function AiQuestionsWeeklyDigest({
    recipientName,
    locale,
    listings,
    preferencesUrl
}: AiQuestionsWeeklyDigestProps) {
    const copy = COPY[locale];
    return (
        <EmailLayout previewText={copy.preview}>
            <Heading>{copy.heading}</Heading>
            <Text style={styles.paragraph}>{copy.greeting(recipientName)}</Text>
            <Text style={styles.paragraph}>{copy.intro}</Text>

            {listings.map((listing) => {
                const hidden = listing.unansweredCount - listing.questions.length;
                return (
                    <Section
                        key={listing.panelUrl}
                        style={styles.listingBox}
                    >
                        <Text style={styles.listingName}>{listing.listingName}</Text>
                        <Text style={styles.count}>{copy.count(listing.unansweredCount)}</Text>
                        {listing.questions.map((question) => (
                            <Text
                                key={question}
                                style={styles.question}
                            >
                                «{question}»
                            </Text>
                        ))}
                        {hidden > 0 ? <Text style={styles.count}>{copy.more(hidden)}</Text> : null}
                        <Button href={listing.panelUrl}>{copy.cta}</Button>
                    </Section>
                );
            })}

            <Text style={styles.footerNote}>
                {copy.optOut} <Link href={preferencesUrl}>{copy.optOutLink}</Link>
            </Text>
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
    listingBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #3b82f6',
        padding: '16px 20px',
        margin: '0 0 16px'
    },
    listingName: {
        color: '#0f172a',
        fontSize: '16px',
        fontWeight: 600,
        lineHeight: '22px',
        margin: '0 0 4px'
    },
    count: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0 0 8px'
    },
    question: {
        color: '#334155',
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0 0 6px'
    },
    footerNote: {
        color: '#64748b',
        fontSize: '13px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
