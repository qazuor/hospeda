import { Section, Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for the PartnerUnpaidNotice email template (HOS-278 R-3).
 */
export interface PartnerUnpaidNoticeProps {
    /** Display name of the partner's owner. */
    readonly recipientName: string;
    /** Name of the partner listing that has not been paid for. */
    readonly partnerName: string;
    /** How many days from now the listing gets archived if nothing changes. */
    readonly daysUntilArchive: number;
}

/**
 * Email sent once, partway through the unpaid window, before a partner listing
 * is archived (R-3).
 *
 * ## Why this exists at all
 *
 * R-3 is "datos cargados que nunca se pagan — definir cuánto viven". The answer
 * chosen was two stages, and this is the first: nothing is archived without the
 * partner having been given a chance to act. Archiving silently would mean the
 * partner discovers it by walking into an empty page.
 *
 * ## Why it is sent exactly once
 *
 * `partners.unpaid_notice_sent_at` is what makes that true. Without it the cron
 * would re-send this every day until the partner pays or is archived — sixty
 * emails is not a reminder, it is a reason to mark the sender as spam.
 *
 * ## Why it does not say "your data will be deleted"
 *
 * Because it will not be. Archiving flips `lifecycleState`; the row, the
 * content and the owner all survive and an admin can reverse it. Copy must
 * never promise behaviour the software does not have — R-5 — and that includes
 * threatening consequences harsher than the real ones.
 *
 * @param props - Template data.
 */
export function PartnerUnpaidNotice({
    recipientName,
    partnerName,
    daysUntilArchive
}: PartnerUnpaidNoticeProps) {
    return (
        <EmailLayout
            previewText={`${partnerName} todavía no está publicado`}
            showUnsubscribe={false}
        >
            <Heading>Tu ficha de aliado sigue pendiente</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Hace un tiempo aprobamos tu postulación y creamos la ficha de{' '}
                <strong>{partnerName}</strong>, pero todavía no está publicada.
            </Text>

            <Section style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                    Si en los próximos {daysUntilArchive} días no se completa, vamos a archivarla.
                    No se borra nada: tus datos quedan guardados y podemos reactivarla cuando
                    quieras.
                </Text>
            </Section>

            <Text style={styles.paragraph}>
                Si querés retomarlo o tenés dudas sobre algún paso, respondé este email y te damos
                una mano.
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
    noticeBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #94a3b8',
        padding: '20px 24px',
        margin: '0 0 24px'
    },
    noticeText: {
        color: '#334155',
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0'
    }
};
