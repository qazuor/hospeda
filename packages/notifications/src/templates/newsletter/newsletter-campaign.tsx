import { Hr, Link, Section, Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for NewsletterCampaign template (wrapper)
 */
export interface NewsletterCampaignProps {
    /** Campaign subject — rendered as H1 at the top of the body */
    subject: string;
    /**
     * Pre-rendered, sanitised HTML body for the campaign.
     *
     * SECURITY: This HTML is injected verbatim into the email DOM. It MUST
     * have been produced by `renderTiptapEmailContent()` in
     * `packages/notifications/src/utils/tiptap-email-renderer.ts` (T-101-15),
     * which strips disallowed tags, applies inline styles, and escapes
     * untrusted content. Do NOT pass arbitrary admin-typed or user-supplied
     * HTML directly to this prop.
     */
    bodyHtml: string;
    /**
     * Stable unsubscribe URL with HMAC token. Used for the explicit
     * unsubscribe CTA in the footer (not the EmailLayout placeholder).
     */
    unsubscribeUrl: string;
    /** Optional preheader text (shown in inbox preview, separate from subject) */
    preheaderText?: string;
    /** When true, prefixes subject and shows a test banner at the top */
    isTest?: boolean;
}

/**
 * Newsletter campaign email wrapper
 *
 * Wraps pre-rendered TipTap HTML with Hospeda branding header, the campaign
 * subject as H1, and a footer with the stable unsubscribe link.
 *
 * SECURITY CONTRACT: `bodyHtml` MUST be sanitised upstream (see T-101-15
 * tiptap-email-renderer). This template trusts the input.
 *
 * @param props - Campaign payload
 */
export function NewsletterCampaign(props: NewsletterCampaignProps) {
    const { subject, bodyHtml, unsubscribeUrl, preheaderText, isTest = false } = props;

    const previewText = preheaderText?.trim()
        ? isTest
            ? `[PRUEBA] ${preheaderText.trim()}`
            : preheaderText.trim()
        : isTest
          ? `[PRUEBA] ${subject}`
          : subject;

    const displaySubject = isTest ? `[PRUEBA] ${subject}` : subject;

    // SECURITY: bodyHtml is pre-sanitised by tiptap-email-renderer (T-101-15).
    // This is a deliberate injection point for trusted campaign HTML.
    const sanitisedBody = { __html: bodyHtml };

    return (
        <EmailLayout previewText={previewText}>
            {isTest && (
                <Section style={styles.testBanner}>
                    <Text style={styles.testBannerText}>
                        [PRUEBA] Este es un envío de prueba. No fue enviado a la lista real.
                    </Text>
                </Section>
            )}

            <Heading>{displaySubject}</Heading>

            <div
                style={styles.body}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: bodyHtml is pre-sanitised by tiptap-email-renderer (T-101-15). See security contract in props JSDoc.
                dangerouslySetInnerHTML={sanitisedBody}
            />

            <Hr style={styles.divider} />

            <Section style={styles.unsubscribeSection}>
                <Text style={styles.unsubscribeText}>
                    ¿No querés recibir más estos correos?{' '}
                    <Link
                        href={unsubscribeUrl}
                        style={styles.unsubscribeLink}
                    >
                        Darme de baja
                    </Link>
                </Text>
            </Section>
        </EmailLayout>
    );
}

const styles = {
    testBanner: {
        backgroundColor: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '6px',
        padding: '12px 16px',
        margin: '0 0 24px'
    },
    testBannerText: {
        color: '#92400e',
        fontSize: '14px',
        fontWeight: '600',
        margin: 0,
        textAlign: 'center' as const
    },
    body: {
        color: '#1e293b',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '16px 0 24px'
    },
    divider: {
        borderColor: '#e2e8f0',
        margin: '32px 0 16px'
    },
    unsubscribeSection: {
        margin: '0 0 8px',
        textAlign: 'center' as const
    },
    unsubscribeText: {
        color: '#64748b',
        fontSize: '13px',
        lineHeight: '20px',
        margin: 0
    },
    unsubscribeLink: {
        color: '#64748b',
        textDecoration: 'underline'
    }
};
