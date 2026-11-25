import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';

/** Locales this notice is written in (HOS-2589). */
export type VipPromotionsPausedLocale = 'es' | 'en' | 'pt';

/** Props of {@link VipPromotionsPaused}. */
export interface VipPromotionsPausedProps {
    readonly recipientName: string;
    readonly locale: VipPromotionsPausedLocale;
    /** Titles of the paused promotions. Never empty. */
    readonly promotionTitles: readonly string[];
    /** Absolute link to the owner's promotions page. */
    readonly promotionsUrl: string;
}

/** Copy per locale. Kept here because this package does not use `@repo/i18n`. */
const COPY = {
    es: {
        preview: 'Pausamos tus promociones «Solo VIP»',
        heading: 'Pausamos tus promociones «Solo VIP»',
        greeting: (name: string) => (name.trim() ? `Hola, ${name.trim()}:` : 'Hola:'),
        reason: 'Tu plan ya no incluye la opción «Solo VIP», así que pausamos estas promociones. No las borramos ni las cambiamos:',
        next: 'Podés reanudarlas como «Para todos» cuando quieras, o volver a «Solo VIP» con un plan que la incluya.',
        cta: 'Ver mis promociones'
    },
    en: {
        preview: 'We paused your «VIP only» promotions',
        heading: 'We paused your «VIP only» promotions',
        greeting: (name: string) => (name.trim() ? `Hi ${name.trim()},` : 'Hi,'),
        reason: 'Your plan no longer includes the «VIP only» option, so we paused these promotions. We did not delete or change them:',
        next: 'You can resume them as «For everyone» at any time, or go back to «VIP only» with a plan that includes it.',
        cta: 'See my promotions'
    },
    pt: {
        preview: 'Pausamos suas promoções «Só VIP»',
        heading: 'Pausamos suas promoções «Só VIP»',
        greeting: (name: string) => (name.trim() ? `Olá, ${name.trim()}:` : 'Olá:'),
        reason: 'Seu plano não inclui mais a opção «Só VIP», então pausamos estas promoções. Não as apagamos nem alteramos:',
        next: 'Você pode retomá-las como «Para todos» quando quiser, ou voltar a «Só VIP» com um plano que a inclua.',
        cta: 'Ver minhas promoções'
    }
} as const;

/** Subject per locale. */
const SUBJECT = {
    es: (n: number) =>
        n === 1 ? 'Pausamos 1 promoción «Solo VIP»' : `Pausamos ${n} promociones «Solo VIP»`,
    en: (n: number) =>
        n === 1 ? 'We paused 1 «VIP only» promotion' : `We paused ${n} «VIP only» promotions`,
    pt: (n: number) =>
        n === 1 ? 'Pausamos 1 promoção «Só VIP»' : `Pausamos ${n} promoções «Só VIP»`
} as const;

/**
 * Builds the localised subject of the notice.
 *
 * @param input - Locale and the number of paused promotions.
 * @returns `{ subject }`.
 */
export function buildVipPromotionsPausedSubject(input: {
    readonly locale: VipPromotionsPausedLocale;
    readonly count: number;
}): { readonly subject: string } {
    return { subject: SUBJECT[input.locale](input.count) };
}

/**
 * Tells an owner which «Solo VIP» promotions were paused because their plan lost
 * `vip_only_promotions` (HOS-2589 D-8, AC-36). Carries no tourist data.
 *
 * @param props - Template data.
 */
export function VipPromotionsPaused({
    recipientName,
    locale,
    promotionTitles,
    promotionsUrl
}: VipPromotionsPausedProps) {
    const copy = COPY[locale];
    return (
        <EmailLayout previewText={copy.preview}>
            <Heading>{copy.heading}</Heading>
            <Text style={styles.paragraph}>{copy.greeting(recipientName)}</Text>
            <Text style={styles.paragraph}>{copy.reason}</Text>
            <Callout tone="warning">
                {promotionTitles.map((title) => (
                    <Text
                        key={title}
                        style={styles.item}
                    >
                        · {title}
                    </Text>
                ))}
            </Callout>
            <Text style={styles.paragraph}>{copy.next}</Text>
            <Button href={promotionsUrl}>{copy.cta}</Button>
        </EmailLayout>
    );
}

const styles = {
    paragraph: { color: '#475569', fontSize: '16px', lineHeight: '24px', margin: '0 0 16px' },
    item: { color: '#0f172a', fontSize: '15px', lineHeight: '22px', margin: '0 0 4px' }
};
