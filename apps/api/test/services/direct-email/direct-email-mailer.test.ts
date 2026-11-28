/**
 * Tests for the direct email mailer (HOS-2685): the preview and the send render the same
 * template with a sanitised body, the opt-out line and the `[PRUEBA]` banner only for a
 * test.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSendDirectAppEmail } = vi.hoisted(() => ({ mockSendDirectAppEmail: vi.fn() }));

vi.mock('../../../src/utils/email-sender', () => ({
    sendDirectAppEmail: mockSendDirectAppEmail
}));

vi.mock('../../../src/utils/env', () => ({
    env: { HOSPEDA_EMAIL_API_KEY: 'brevo-key', HOSPEDA_DEPLOY_ENV: 'prod' }
}));

import { createDirectEmailMailer } from '../../../src/services/direct-email/direct-email-mailer';

const OPT_OUT_URL = 'https://hospeda.com.ar/es/correos/baja/?token=abc.def';

const body = (text: string, href?: string) => ({
    type: 'doc' as const,
    content: [
        {
            type: 'paragraph',
            content: [
                {
                    type: 'text',
                    text,
                    ...(href ? { marks: [{ type: 'link', attrs: { href } }] } : {})
                }
            ]
        }
    ]
});

describe('createDirectEmailMailer', () => {
    beforeEach(() => {
        mockSendDirectAppEmail.mockReset();
        mockSendDirectAppEmail.mockResolvedValue({ success: true, messageId: '<id@brevo>' });
    });

    it('renders the full layout with the body and the opt-out link, no banner (AC-7)', async () => {
        // Arrange
        const mailer = createDirectEmailMailer();

        // Act
        const html = await mailer.renderHtml({
            subject: 'Propuesta',
            bodyJson: body('Hola equipo'),
            optOutUrl: OPT_OUT_URL,
            isTest: false
        });

        // Assert
        expect(html).toContain('Hola equipo');
        expect(html).toContain('No quiero recibir más correos de Hospeda');
        expect(html).toContain('/es/correos/baja/');
        expect(html).not.toContain('[PRUEBA]');
        expect(html).toContain('prefers-color-scheme');
    });

    it('strips javascript: links and raw HTML from the body (AC-12)', async () => {
        // Arrange
        const mailer = createDirectEmailMailer();

        // Act
        const html = await mailer.renderHtml({
            subject: 'x',
            bodyJson: body('<img src=x onerror=alert(1)>clic', 'javascript:alert(1)'),
            optOutUrl: OPT_OUT_URL,
            isTest: false
        });

        // Assert
        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('<img src=x');
    });

    it('sends one message through the direct sender with From, name, Reply-To and the catalog key', async () => {
        // Arrange
        const mailer = createDirectEmailMailer();

        // Act
        const outcome = await mailer.send({
            to: 'a@example.com',
            subject: 'Propuesta',
            bodyJson: body('Hola'),
            optOutUrl: OPT_OUT_URL,
            isTest: false,
            fromEmail: 'contacto@comercial.hospeda.com.ar',
            fromName: 'Laura de Hospeda',
            replyTo: 'laura@hospeda.com.ar'
        });

        // Assert
        expect(outcome).toEqual({ success: true, messageId: '<id@brevo>' });
        expect(mockSendDirectAppEmail).toHaveBeenCalledTimes(1);
        const call = mockSendDirectAppEmail.mock.calls[0]?.[0];
        expect(call).toMatchObject({
            to: 'a@example.com',
            subject: 'Propuesta',
            fromEmail: 'contacto@comercial.hospeda.com.ar',
            fromName: 'Laura de Hospeda',
            replyTo: 'laura@hospeda.com.ar',
            attribution: { medium: 'transactional', templateKey: 'newsletter.direct-email' }
        });
    });

    it('reports a provider failure instead of throwing', async () => {
        // Arrange
        mockSendDirectAppEmail.mockResolvedValue({ success: false, error: 'sender rejected' });
        const mailer = createDirectEmailMailer();

        // Act
        const outcome = await mailer.send({
            to: 'a@example.com',
            subject: 's',
            bodyJson: body('Hola'),
            optOutUrl: OPT_OUT_URL,
            isTest: false,
            fromEmail: 'x@y.com',
            fromName: 'n',
            replyTo: 'r@y.com'
        });

        // Assert
        expect(outcome).toEqual({ success: false, error: 'sender rejected' });
    });

    it('fails explicitly without a Brevo API key', async () => {
        // Arrange
        const mailer = createDirectEmailMailer({ apiKey: '' });

        // Act
        const outcome = await mailer.send({
            to: 'a@example.com',
            subject: 's',
            bodyJson: body('Hola'),
            optOutUrl: OPT_OUT_URL,
            isTest: false,
            fromEmail: 'x@y.com',
            fromName: 'n',
            replyTo: 'r@y.com'
        });

        // Assert
        expect(outcome.success).toBe(false);
        expect(mockSendDirectAppEmail).not.toHaveBeenCalled();
    });
});
