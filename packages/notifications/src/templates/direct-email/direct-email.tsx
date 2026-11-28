import { Hr, Link, Section, Text } from '@react-email/components';
import { Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';

/**
 * Props for the DirectEmail template (HOS-2685).
 */
export interface DirectEmailProps {
    /** Email subject as the recipient reads it (already prefixed `[PRUEBA]` on a test), used as the inbox preview text. */
    subject: string;
    /**
     * Pre-rendered, sanitised HTML body.
     *
     * SECURITY: injected verbatim into the email DOM. It MUST come from
     * `renderTiptapEmailContent()` in `packages/notifications/src/utils/tiptap-email-renderer.ts`,
     * which strips disallowed tags and unsafe URLs. Never pass admin-typed or
     * user-supplied HTML directly.
     */
    bodyHtml: string;
    /** Signed URL of the opt-out page for this recipient. */
    optOutUrl: string;
    /** When true, shows the test banner at the top. */
    isTest?: boolean;
}

/**
 * One-to-one email an admin composes by hand. Same user layout as the
 * newsletter (header, dark mode, footer), the subject as the title row, the admin's
 * body, and an opt-out line under it. The layout footer link is hidden: the opt-out line replaces it.
 *
 * SECURITY CONTRACT: `bodyHtml` MUST be sanitised upstream; this template trusts it.
 *
 * @param props - Message payload
 */
export function DirectEmail(props: DirectEmailProps) {
    const { subject, bodyHtml, optOutUrl, isTest = false } = props;

    // SECURITY: deliberate injection point for the sanitised admin body.
    const sanitisedBody = { __html: bodyHtml };

    return (
        <EmailLayout
            footerLink="none"
            previewText={subject}
        >
            {isTest && (
                <Callout tone="warning">
                    <Text style={styles.testBannerText}>
                        [PRUEBA] Este es un envío de prueba. No fue enviado a ningún destinatario
                        real.
                    </Text>
                </Callout>
            )}

            <Heading>{subject}</Heading>

            <div
                style={styles.body}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: bodyHtml is pre-sanitised by renderTiptapEmailContent. See security contract in props JSDoc.
                dangerouslySetInnerHTML={sanitisedBody}
            />

            <Hr style={styles.divider} />

            <Section style={styles.optOutSection}>
                <Text style={styles.optOutText}>
                    <Link
                        href={optOutUrl}
                        style={styles.optOutLink}
                    >
                        No quiero recibir más correos de Hospeda
                    </Link>
                </Text>
            </Section>
        </EmailLayout>
    );
}

const styles = {
    testBannerText: {
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
    optOutSection: {
        margin: '0 0 8px',
        textAlign: 'center' as const
    },
    optOutText: {
        color: '#64748b',
        fontSize: '13px',
        lineHeight: '20px',
        margin: 0
    },
    optOutLink: {
        color: '#64748b',
        textDecoration: 'underline'
    }
};
