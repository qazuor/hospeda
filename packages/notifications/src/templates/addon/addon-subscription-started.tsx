import { Section, Text } from '@react-email/components';
import { formatCalendarDate } from '@repo/utils';
import type { AddonLinkLocale } from '../../types/notification.types.js';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { buildAddonManagementUrl, formatCurrency } from '../utils/index.js';

/**
 * Props for the recurring add-on subscription notice (HOS-847 PR 5).
 */
export interface AddonSubscriptionStartedProps {
    /** Customer display name. */
    readonly customerName: string;
    /** Human-readable add-on name, already resolved in the recipient's locale. */
    readonly addonName: string;
    /** Short description of what the add-on provides. Optional. */
    readonly addonDescription?: string;
    /** Amount charged now — and on every future charge — in centavos. */
    readonly amount: number;
    /** ISO 4217 currency code. */
    readonly currency?: string;
    /** Charge cadence. */
    readonly billingInterval: 'monthly' | 'annual';
    /** ISO 8601 timestamp of the next charge. */
    readonly nextChargeAt: string;
    /** Base URL for CTA links (e.g. `https://hospeda.com.ar`). */
    readonly baseUrl: string;
    /** Add-on catalog slug; deep-links the CTA to this add-on (HOS-722). */
    readonly addonSlug?: string;
    /** Recipient's locale. Falls back to `'es'`. */
    readonly locale?: AddonLinkLocale;
}

/**
 * Copy, per locale.
 *
 * The three locales are spelled out rather than resolved through `@repo/i18n`
 * because that is how this package works today: every other template hardcodes
 * Spanish and documents `locale` as "does not alter content". This is the first
 * add-on template that actually varies by locale, and it does so locally rather
 * than by introducing a translation mechanism into `@repo/notifications` as a
 * side effect of one email.
 *
 * The wording is deliberately plain and un-promotional. THE COPY IS THE OWNER'S
 * TO SET — this is a correct, sober draft, not a finished voice.
 */
const COPY: Record<
    AddonLinkLocale,
    {
        readonly dateLocale: string;
        readonly preview: (addonName: string) => string;
        readonly heading: string;
        readonly greeting: (name: string) => string;
        readonly intro: string;
        readonly labelAddon: string;
        readonly labelDescription: string;
        readonly labelCharged: string;
        readonly labelCadence: string;
        readonly labelNextCharge: string;
        readonly cadence: Record<'monthly' | 'annual', string>;
        readonly renewalNotice: string;
        readonly cancelNotice: string;
        readonly cta: string;
    }
> = {
    es: {
        dateLocale: 'es-AR',
        preview: (addonName) => `Suscripción activa: ${addonName}`,
        heading: 'Tu complemento quedó activo',
        greeting: (name) => `Hola ${name},`,
        intro: 'Activamos tu complemento y ya podés usarlo. Este complemento es una suscripción: se renueva sola y te vamos a cobrar de nuevo.',
        labelAddon: 'Complemento',
        labelDescription: 'Descripción',
        labelCharged: 'Monto cobrado',
        labelCadence: 'Se cobra',
        labelNextCharge: 'Próximo cobro',
        cadence: { monthly: 'Todos los meses', annual: 'Una vez por año' },
        renewalNotice:
            'Vamos a cobrar el mismo monto en la tarjeta que usaste, en la fecha del próximo cobro, y así sucesivamente hasta que lo canceles.',
        cancelNotice:
            'Podés cancelarlo cuando quieras desde tus complementos. Si lo cancelás, no se cobra de nuevo y el complemento sigue activo hasta el final del período que ya pagaste.',
        cta: 'Ver mis complementos'
    },
    en: {
        dateLocale: 'en-US',
        preview: (addonName) => `Subscription active: ${addonName}`,
        heading: 'Your add-on is active',
        greeting: (name) => `Hi ${name},`,
        intro: 'Your add-on is active and ready to use. This add-on is a subscription: it renews on its own and you will be charged again.',
        labelAddon: 'Add-on',
        labelDescription: 'Description',
        labelCharged: 'Amount charged',
        labelCadence: 'Billed',
        labelNextCharge: 'Next charge',
        cadence: { monthly: 'Every month', annual: 'Once a year' },
        renewalNotice:
            'We will charge the same amount to the card you used, on the next charge date, and again after that until you cancel.',
        cancelNotice:
            'You can cancel it at any time from your add-ons. If you cancel, you are not charged again and the add-on stays active until the end of the period you have already paid for.',
        cta: 'View my add-ons'
    },
    pt: {
        dateLocale: 'pt-BR',
        preview: (addonName) => `Assinatura ativa: ${addonName}`,
        heading: 'Seu complemento está ativo',
        greeting: (name) => `Olá ${name},`,
        intro: 'Seu complemento está ativo e pronto para usar. Este complemento é uma assinatura: ele se renova sozinho e você será cobrado novamente.',
        labelAddon: 'Complemento',
        labelDescription: 'Descrição',
        labelCharged: 'Valor cobrado',
        labelCadence: 'Cobrança',
        labelNextCharge: 'Próxima cobrança',
        cadence: { monthly: 'Todo mês', annual: 'Uma vez por ano' },
        renewalNotice:
            'Vamos cobrar o mesmo valor no cartão que você usou, na data da próxima cobrança, e assim por diante até você cancelar.',
        cancelNotice:
            'Você pode cancelar quando quiser em seus complementos. Se cancelar, não haverá nova cobrança e o complemento continua ativo até o fim do período já pago.',
        cta: 'Ver meus complementos'
    }
};

/**
 * The notice sent when a RECURRING add-on's first charge settles (HOS-847 PR 5).
 *
 * Deliberately not `AddonPurchaseConfirmation`: that template says a purchase
 * "has been processed", which is true of a one-time add-on and misleading for
 * someone who has just authorised a MercadoPago preapproval. Everything a
 * subscriber has to be told and a one-time buyer does not — the cadence, the
 * next charge date, and how to stop it — is required here, not optional.
 *
 * @param props - See {@link AddonSubscriptionStartedProps}.
 */
export function AddonSubscriptionStarted({
    customerName,
    addonName,
    addonDescription,
    amount,
    currency = 'ARS',
    billingInterval,
    nextChargeAt,
    baseUrl,
    addonSlug,
    locale
}: AddonSubscriptionStartedProps) {
    const copy = COPY[locale ?? 'es'] ?? COPY.es;
    const formattedAmount = formatCurrency({ amount, currency });
    const formattedNextCharge =
        formatCalendarDate({
            value: nextChargeAt,
            locale: copy.dateLocale,
            options: { day: 'numeric', month: 'long', year: 'numeric' }
        }) ?? '';
    const manageUrl = buildAddonManagementUrl({ baseUrl, locale, addonSlug });

    return (
        <EmailLayout previewText={copy.preview(addonName)}>
            <Heading>{copy.heading}</Heading>

            <Text style={styles.greeting}>{copy.greeting(customerName)}</Text>

            <Text style={styles.paragraph}>{copy.intro}</Text>

            <Section style={styles.successBox}>
                <InfoRow
                    label={copy.labelAddon}
                    value={addonName}
                />
                {addonDescription ? (
                    <InfoRow
                        label={copy.labelDescription}
                        value={addonDescription}
                    />
                ) : null}
                <InfoRow
                    label={copy.labelCharged}
                    value={formattedAmount}
                />
                <InfoRow
                    label={copy.labelCadence}
                    value={copy.cadence[billingInterval]}
                />
                <InfoRow
                    label={copy.labelNextCharge}
                    value={formattedNextCharge}
                />
            </Section>

            <Text style={styles.paragraph}>{copy.renewalNotice}</Text>

            <Text style={styles.paragraph}>{copy.cancelNotice}</Text>

            <Section style={styles.buttonContainer}>
                <Button href={manageUrl}>{copy.cta}</Button>
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
    successBox: {
        backgroundColor: '#f0fdf4',
        borderRadius: '8px',
        borderLeft: '4px solid #22c55e',
        padding: '24px',
        margin: '24px 0'
    },
    buttonContainer: {
        margin: '32px 0',
        textAlign: 'center' as const
    }
};
