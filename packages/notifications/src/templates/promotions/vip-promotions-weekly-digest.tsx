import { Link, Section, Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';

/** Locales this digest is written in (HOS-2589). */
export type VipPromotionsDigestLocale = 'es' | 'en' | 'pt';

/** One promotion as the digest renders it. */
export interface VipPromotionsDigestItem {
    /** Promotion title. */
    readonly title: string;
    /** The benefit, already localised («20% off», «$ 5.000 off», a special offer). */
    readonly benefit: string;
    /** Name of the place it hangs on. */
    readonly placeName: string;
    /** Absolute link to the place's public page. */
    readonly placeUrl: string;
    /** `true` for a «Solo VIP» promotion, shown with the VIP mark. */
    readonly vipOnly: boolean;
    /** Localised «desde …» when it starts in the future, else `null`. */
    readonly startsLabel: string | null;
}

/** Props of {@link VipPromotionsWeeklyDigest}. */
export interface VipPromotionsWeeklyDigestProps {
    readonly recipientName: string;
    readonly locale: VipPromotionsDigestLocale;
    /** Never empty: the cron sends nothing on a week without new promotions. */
    readonly promotions: readonly VipPromotionsDigestItem[];
    /** New promotions of the week beyond the ones listed. */
    readonly moreCount: number;
    /** Absolute link to `/{lang}/promociones/`. */
    readonly promotionsUrl: string;
    /** Account preferences page, where the digest can be switched off. */
    readonly preferencesUrl: string;
}

/** Copy per locale. Kept here because this package does not use `@repo/i18n`. */
const COPY = {
    es: {
        preview: 'Las promociones nuevas de la semana en Hospeda',
        heading: 'Promociones nuevas de la semana',
        greeting: (name: string) => (name.trim() ? `Hola, ${name.trim()}:` : 'Hola:'),
        intro: 'Como turista VIP ves todas las promociones. Estas son las que se activaron la semana pasada.',
        vip: 'VIP',
        place: 'Ver el lugar',
        more: (n: number) => (n === 1 ? 'y 1 promoción más' : `y ${n} promociones más`),
        cta: 'Ver todas las promociones',
        optOut: '¿No querés recibir este resumen?',
        optOutLink: 'Desactivalo desde tus preferencias'
    },
    en: {
        preview: "This week's new promotions on Hospeda",
        heading: "This week's new promotions",
        greeting: (name: string) => (name.trim() ? `Hi ${name.trim()},` : 'Hi,'),
        intro: 'As a VIP tourist you see every promotion. These are the ones that went live last week.',
        vip: 'VIP',
        place: 'See the place',
        more: (n: number) => (n === 1 ? 'and 1 more promotion' : `and ${n} more promotions`),
        cta: 'See all promotions',
        optOut: "Don't want this summary?",
        optOutLink: 'Turn it off in your preferences'
    },
    pt: {
        preview: 'As promoções novas da semana na Hospeda',
        heading: 'Promoções novas da semana',
        greeting: (name: string) => (name.trim() ? `Olá, ${name.trim()}:` : 'Olá:'),
        intro: 'Como turista VIP você vê todas as promoções. Estas foram ativadas na semana passada.',
        vip: 'VIP',
        place: 'Ver o lugar',
        more: (n: number) => (n === 1 ? 'e mais 1 promoção' : `e mais ${n} promoções`),
        cta: 'Ver todas as promoções',
        optOut: 'Não quer receber este resumo?',
        optOutLink: 'Desative nas suas preferências'
    }
} as const;

/** Subject per locale. */
const SUBJECT = {
    es: (n: number) =>
        n === 1 ? '1 promoción nueva esta semana' : `${n} promociones nuevas esta semana`,
    en: (n: number) => (n === 1 ? '1 new promotion this week' : `${n} new promotions this week`),
    pt: (n: number) =>
        n === 1 ? '1 promoção nova nesta semana' : `${n} promoções novas nesta semana`
} as const;

/**
 * Builds the localised subject of the digest.
 *
 * @param input - Locale and the total of new promotions in the week.
 * @returns `{ subject }`.
 */
export function buildVipPromotionsDigestSubject(input: {
    readonly locale: VipPromotionsDigestLocale;
    readonly total: number;
}): { readonly subject: string } {
    return { subject: SUBJECT[input.locale](input.total) };
}

/**
 * Weekly email to a VIP tourist with the promotions first activated in the previous
 * week (HOS-2589 §7.7). Both audiences; a «Solo VIP» one carries the VIP mark.
 *
 * @param props - Template data.
 */
export function VipPromotionsWeeklyDigest({
    recipientName,
    locale,
    promotions,
    moreCount,
    promotionsUrl,
    preferencesUrl
}: VipPromotionsWeeklyDigestProps) {
    const copy = COPY[locale];
    return (
        <EmailLayout previewText={copy.preview}>
            <Heading>{copy.heading}</Heading>
            <Text style={styles.paragraph}>{copy.greeting(recipientName)}</Text>
            <Text style={styles.paragraph}>{copy.intro}</Text>

            {promotions.map((promotion) => (
                <Section
                    key={`${promotion.placeUrl}#${promotion.title}`}
                    style={styles.item}
                >
                    <Callout
                        tone="info"
                        title={
                            promotion.vipOnly ? `${promotion.title} · ${copy.vip}` : promotion.title
                        }
                    >
                        <Text style={styles.benefit}>{promotion.benefit}</Text>
                        {promotion.startsLabel ? (
                            <Text style={styles.meta}>{promotion.startsLabel}</Text>
                        ) : null}
                        <Text style={styles.meta}>
                            {promotion.placeName} ·{' '}
                            <Link href={promotion.placeUrl}>{copy.place}</Link>
                        </Text>
                    </Callout>
                </Section>
            ))}

            {moreCount > 0 ? <Text style={styles.meta}>{copy.more(moreCount)}</Text> : null}
            <Button href={promotionsUrl}>{copy.cta}</Button>

            <Text style={styles.footerNote}>
                {copy.optOut} <Link href={preferencesUrl}>{copy.optOutLink}</Link>
            </Text>
        </EmailLayout>
    );
}

const styles = {
    paragraph: { color: '#475569', fontSize: '16px', lineHeight: '24px', margin: '0 0 16px' },
    item: { margin: '0 0 16px' },
    benefit: { color: '#334155', fontSize: '15px', lineHeight: '22px', margin: '0 0 6px' },
    meta: { color: '#64748b', fontSize: '14px', lineHeight: '20px', margin: '0 0 6px' },
    footerNote: {
        color: '#64748b',
        fontSize: '13px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
