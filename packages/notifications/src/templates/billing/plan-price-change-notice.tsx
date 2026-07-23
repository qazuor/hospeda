import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { formatCurrency, formatDate } from '../utils/index.js';

/**
 * Props for the PlanPriceChangeNotice email template (HOS-176 Increment A).
 */
export interface PlanPriceChangeNoticeProps {
    recipientName: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar'). */
    baseUrl: string;
    /** Human-readable plan name. */
    planName: string;
    /** Current (old) recurring price in integer centavos. */
    oldPriceArs: number;
    /** New (higher) recurring price in integer centavos. */
    newPriceArs: number;
    /** ISO 8601 date-time string for when the new price takes effect. */
    effectiveDate: string;
    /** Which price interval is changing: `month` | `year`. */
    billingInterval: string;
}

/**
 * Plan price-INCREASE advance notice email (HOS-176 Increment A).
 *
 * Argentine consumer-protection law (Disposición 954/2025) requires PRIOR
 * notice and a grace window before a recurring price is raised. This email is
 * sent when the increase enters its notice phase; the higher amount is applied
 * only after the grace window elapses. The body states the old price, the new
 * price, the effective date, and that the subscriber may cancel before then.
 *
 * TODO(HOS-176 D-3): PROVISIONAL copy in place — pending legal sign-off. The
 * body and subject are a provisional, good-faith draft covering the elements a
 * price-increase prior notice is expected to carry (the increase itself, the
 * old/new amounts, the effective date, the >=15-day advance window, and the
 * free right to cancel before then). It has NOT been reviewed by counsel. It
 * MUST be reviewed/approved by the owner/legal, and this marker removed, BEFORE
 * the increase flag (HOSPEDA_BILLING_PRICE_INCREASE_ENABLED) is enabled in prod.
 *
 * @param props - Plan price-change notice data.
 */
export function PlanPriceChangeNotice({
    recipientName,
    baseUrl,
    planName,
    oldPriceArs,
    newPriceArs,
    effectiveDate,
    billingInterval
}: PlanPriceChangeNoticeProps) {
    const formattedOld = formatCurrency({ amount: oldPriceArs, currency: 'ARS' });
    const formattedNew = formatCurrency({ amount: newPriceArs, currency: 'ARS' });
    const formattedEffectiveDate = formatDate({ dateString: effectiveDate });
    const intervalLabel = billingInterval === 'year' ? 'anual' : 'mensual';

    return (
        <EmailLayout previewText={`Aviso de cambio de precio de tu plan ${planName}`}>
            <Heading>Aviso de cambio de precio</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            {/* PROVISIONAL(HOS-176 D-3): pending legal sign-off — see JSDoc above. */}
            <Text style={styles.paragraph}>
                Te escribimos para avisarte, con al menos 15 días de anticipación, que el precio de
                tu suscripción al plan {planName} ({intervalLabel}) va a aumentar. Te enviamos este
                aviso previo, conforme a la normativa de defensa del consumidor aplicable
                (Disposición 954/2025), para que puedas revisar el cambio y decidir con tiempo antes
                de que el nuevo precio entre en vigencia.
            </Text>

            <Section style={styles.infoBox}>
                <InfoRow
                    label="Precio actual"
                    value={formattedOld}
                />
                <InfoRow
                    label="Precio nuevo"
                    value={formattedNew}
                />
                <InfoRow
                    label="Vigente desde"
                    value={formattedEffectiveDate}
                />
            </Section>

            {/* PROVISIONAL(HOS-176 D-3): pending legal sign-off — see JSDoc above. */}
            <Text style={styles.paragraph}>
                El nuevo precio del plan entrará en vigencia a partir del {formattedEffectiveDate}.
                Si no estás de acuerdo con el aumento, podés cancelar tu suscripción en cualquier
                momento antes de esa fecha, sin costo ni penalidad, desde tu cuenta. Si mantenés la
                suscripción activa después de esa fecha, el nuevo precio se considerará aceptado y
                se facturará según tu plan a partir de tu próximo período.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/mi-cuenta/suscripcion`}>Ver mi suscripción</Button>
            </Section>

            <Text style={styles.footerNote}>
                Si tenés alguna pregunta sobre este cambio, estamos acá para ayudarte.
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
    infoBox: {
        backgroundColor: '#fffbeb',
        borderRadius: '8px',
        borderLeft: '4px solid #f59e0b',
        padding: '24px',
        margin: '24px 0'
    },
    buttonContainer: {
        margin: '32px 0',
        textAlign: 'center' as const
    },
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
