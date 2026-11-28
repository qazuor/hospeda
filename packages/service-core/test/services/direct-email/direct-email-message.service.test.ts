import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type {
    DirectEmailMailerPort,
    DirectEmailMailInput
} from '../../../src/services/direct-email/direct-email.ports.js';
import {
    buildDirectEmailFromName,
    DirectEmailMessageService
} from '../../../src/services/direct-email/direct-email-message.service.js';
import { verifyDirectEmailOptOutToken } from '../../../src/services/direct-email/direct-email-token.helpers.js';
import type { Actor } from '../../../src/types/index.js';

const SECRET = 'a'.repeat(32);
const BODY = {
    type: 'doc' as const,
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }]
};

const buildActor = (permissions: PermissionEnum[]): Actor => ({
    id: '11111111-1111-4111-8111-111111111111',
    roles: [RoleEnum.ADMIN],
    permissions,
    name: 'Laura Vega',
    email: 'Laura@Hospeda.com.ar'
});

const SENDER = buildActor([PermissionEnum.DIRECT_EMAIL_VIEW, PermissionEnum.DIRECT_EMAIL_SEND]);

const buildMailer = (
    send: (
        input: DirectEmailMailInput
    ) => Promise<{ success: boolean; messageId?: string; error?: string }>
) => {
    const sendFn = vi.fn(send);
    const mailer: DirectEmailMailerPort = {
        send: sendFn,
        renderHtml: vi.fn(async () => '<html>preview</html>')
    };
    return { mailer, sendFn };
};

const buildModels = (suppressed: string[] = []) => {
    const messageModel = {
        create: vi.fn(async (data: Record<string, unknown>) => ({ id: 'msg-1', ...data })),
        findPageWithRecipientCount: vi.fn(),
        findMessageById: vi.fn()
    };
    const recipientModel = {
        create: vi.fn(async (data: Record<string, unknown>) => data),
        findByMessageId: vi.fn(),
        findOne: vi.fn(),
        applyProviderEvent: vi.fn()
    };
    const suppressionModel = {
        findSuppressedEmails: vi.fn(async (emails: string[]) =>
            emails.filter((email) => suppressed.includes(email))
        ),
        insertIfAbsent: vi.fn(async () => ({ suppression: {}, created: true }))
    };
    return { messageModel, recipientModel, suppressionModel };
};

const buildService = (input: {
    mailer?: DirectEmailMailerPort;
    suppressed?: string[];
    resolveFromEmail?: () => string;
}) => {
    const models = buildModels(input.suppressed);
    const service = new DirectEmailMessageService(
        {},
        {
            ...(input.mailer ? { mailer: input.mailer } : {}),
            resolveFromEmail: input.resolveFromEmail ?? (() => 'contacto@comercial.hospeda.com.ar'),
            hmacSecret: SECRET,
            siteUrl: 'https://hospeda.com.ar',
            messageModel: models.messageModel as never,
            recipientModel: models.recipientModel as never,
            suppressionModel: models.suppressionModel as never
        }
    );
    return { service, ...models };
};

describe('buildDirectEmailFromName', () => {
    it('uses the first name', () => {
        expect(buildDirectEmailFromName('Laura Vega')).toBe('Laura de Hospeda');
    });

    it('falls back to Hospeda without a name', () => {
        expect(buildDirectEmailFromName(undefined)).toBe('Hospeda');
        expect(buildDirectEmailFromName('   ')).toBe('Hospeda');
    });
});

describe('DirectEmailMessageService.send', () => {
    const request = {
        subject: 'Propuesta',
        bodyJson: BODY,
        recipients: ['a@example.com', 'b@example.com', 'c@example.com']
    };

    it('sends one message per recipient with From, Reply-To and a per-recipient opt-out link', async () => {
        // Arrange
        const { mailer, sendFn } = buildMailer(async (input) => ({
            success: true,
            messageId: `<id-${input.to}>`
        }));
        const { service, recipientModel, messageModel } = buildService({ mailer });

        // Act
        const result = await service.send(SENDER, request);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.messageId).toBe('msg-1');
        expect(result.data?.results.map((r) => r.status)).toEqual(['sent', 'sent', 'sent']);
        expect(sendFn).toHaveBeenCalledTimes(3);
        const first = sendFn.mock.calls[0]?.[0] as DirectEmailMailInput;
        expect(first.to).toBe('a@example.com');
        expect(first.fromEmail).toBe('contacto@comercial.hospeda.com.ar');
        expect(first.fromName).toBe('Laura de Hospeda');
        expect(first.replyTo).toBe('laura@hospeda.com.ar');
        expect(first.isTest).toBe(false);
        const token = new URL(first.optOutUrl).searchParams.get('token') ?? '';
        expect(verifyDirectEmailOptOutToken({ token, secret: SECRET }).email).toBe('a@example.com');
        expect(messageModel.create).toHaveBeenCalledWith(
            expect.objectContaining({
                subject: 'Propuesta',
                sentBy: SENDER.id,
                fromEmail: 'contacto@comercial.hospeda.com.ar',
                replyToEmail: 'laura@hospeda.com.ar'
            }),
            undefined
        );
        expect(recipientModel.create).toHaveBeenCalledTimes(3);
    });

    it('keeps sending when one recipient fails and records the reason', async () => {
        // Arrange
        const { mailer, sendFn } = buildMailer(async (input) =>
            input.to === 'b@example.com'
                ? { success: false, error: 'mailbox rejected' }
                : { success: true, messageId: `<id-${input.to}>` }
        );
        const { service, recipientModel } = buildService({ mailer });

        // Act
        const result = await service.send(SENDER, request);

        // Assert
        expect(result.data?.results).toEqual([
            {
                email: 'a@example.com',
                status: 'sent',
                providerMessageId: '<id-a@example.com>',
                error: null
            },
            {
                email: 'b@example.com',
                status: 'failed',
                providerMessageId: null,
                error: 'mailbox rejected'
            },
            {
                email: 'c@example.com',
                status: 'sent',
                providerMessageId: '<id-c@example.com>',
                error: null
            }
        ]);
        expect(sendFn).toHaveBeenCalledTimes(3);
        expect(recipientModel.create).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'b@example.com',
                status: 'failed',
                errorMessage: 'mailbox rejected'
            }),
            undefined
        );
    });

    it('treats a throwing mailer as a failed recipient and continues', async () => {
        // Arrange
        const { mailer } = buildMailer(async (input) => {
            if (input.to === 'a@example.com') throw new Error('socket hang up');
            return { success: true, messageId: 'ok' };
        });
        const { service } = buildService({ mailer });

        // Act
        const result = await service.send(SENDER, request);

        // Assert
        expect(result.data?.results.map((r) => r.status)).toEqual(['failed', 'sent', 'sent']);
        expect(result.data?.results[0]?.error).toBe('socket hang up');
    });

    it('skips suppressed addresses, reports them and sends the rest', async () => {
        // Arrange
        const { mailer, sendFn } = buildMailer(async () => ({ success: true, messageId: 'ok' }));
        const { service, recipientModel } = buildService({ mailer, suppressed: ['b@example.com'] });

        // Act
        const result = await service.send(SENDER, request);

        // Assert
        expect(result.data?.results.map((r) => [r.email, r.status])).toEqual([
            ['a@example.com', 'sent'],
            ['b@example.com', 'suppressed'],
            ['c@example.com', 'sent']
        ]);
        expect(sendFn.mock.calls.map((call) => (call[0] as DirectEmailMailInput).to)).toEqual([
            'a@example.com',
            'c@example.com'
        ]);
        expect(recipientModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'b@example.com', status: 'suppressed' }),
            undefined
        );
    });

    it('still answers when a history write fails', async () => {
        // Arrange
        const { mailer } = buildMailer(async () => ({ success: true, messageId: 'ok' }));
        const { service, recipientModel } = buildService({ mailer });
        recipientModel.create.mockRejectedValueOnce(new Error('db down'));

        // Act
        const result = await service.send(SENDER, request);

        // Assert
        expect(result.data?.results.map((r) => r.status)).toEqual(['sent', 'sent', 'sent']);
    });

    it.each([
        ['an invalid address', { recipients: ['nope'] }],
        ['a case-insensitive duplicate', { recipients: ['a@example.com', 'A@EXAMPLE.com'] }],
        [
            'more than 20 recipients',
            { recipients: Array.from({ length: 21 }, (_, i) => `u${i}@example.com`) }
        ],
        ['an empty subject', { subject: '  ' }],
        ['an empty body', { bodyJson: { type: 'doc' as const, content: [{ type: 'paragraph' }] } }]
    ])('rejects %s before anything is written or sent', async (_label, override) => {
        // Arrange
        const { mailer, sendFn } = buildMailer(async () => ({ success: true }));
        const { service, messageModel } = buildService({ mailer });

        // Act
        const result = await service.send(SENDER, { ...request, ...override });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(sendFn).not.toHaveBeenCalled();
        expect(messageModel.create).not.toHaveBeenCalled();
    });

    it('is forbidden without DIRECT_EMAIL_SEND', async () => {
        // Arrange
        const { mailer, sendFn } = buildMailer(async () => ({ success: true }));
        const { service } = buildService({ mailer });
        const viewOnly = buildActor([PermissionEnum.DIRECT_EMAIL_VIEW]);

        // Act
        const result = await service.send(viewOnly, request);

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(sendFn).not.toHaveBeenCalled();
    });

    it('uses the injected fallback sender when no direct sender is configured (AC-11)', async () => {
        // Arrange
        const { mailer, sendFn } = buildMailer(async () => ({ success: true, messageId: 'ok' }));
        const { service } = buildService({
            mailer,
            resolveFromEmail: () => 'noreply@hospeda.com.ar'
        });

        // Act
        await service.send(SENDER, { ...request, recipients: ['a@example.com'] });

        // Assert
        const input = sendFn.mock.calls[0]?.[0] as DirectEmailMailInput;
        expect(input.fromEmail).toBe('noreply@hospeda.com.ar');
        expect(input.fromName).toBe('Laura de Hospeda');
        expect(input.replyTo).toBe('laura@hospeda.com.ar');
    });

    it('answers SERVICE_UNAVAILABLE when no mailer is configured', async () => {
        // Arrange
        const { service } = buildService({});

        // Act
        const result = await service.send(SENDER, request);

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.SERVICE_UNAVAILABLE);
    });

    it('refuses to send when the admin has no email on file', async () => {
        // Arrange
        const { mailer, sendFn } = buildMailer(async () => ({ success: true }));
        const { service } = buildService({ mailer });
        const { email: _email, ...noEmail } = SENDER;

        // Act
        const result = await service.send(noEmail as Actor, request);

        // Assert
        expect(result.error?.reason).toBe('DIRECT_EMAIL_SENDER_EMAIL_MISSING');
        expect(sendFn).not.toHaveBeenCalled();
    });
});

describe('DirectEmailMessageService.testSend', () => {
    const body = { subject: 'Hola', bodyJson: BODY };

    it('sends to the admin by default, prefixed [PRUEBA], without history', async () => {
        // Arrange
        const { mailer, sendFn } = buildMailer(async () => ({ success: true, messageId: 'ok' }));
        const { service, messageModel, recipientModel } = buildService({ mailer });

        // Act
        const result = await service.testSend(SENDER, body);

        // Assert
        expect(result.data).toEqual({ sentTo: 'laura@hospeda.com.ar' });
        const input = sendFn.mock.calls[0]?.[0] as DirectEmailMailInput;
        expect(input.subject).toBe('[PRUEBA] Hola');
        expect(input.isTest).toBe(true);
        expect(messageModel.create).not.toHaveBeenCalled();
        expect(recipientModel.create).not.toHaveBeenCalled();
    });

    it('ignores the suppression list for the admin own address', async () => {
        // Arrange
        const { mailer, sendFn } = buildMailer(async () => ({ success: true }));
        const { service } = buildService({ mailer, suppressed: ['laura@hospeda.com.ar'] });

        // Act
        const result = await service.testSend(SENDER, body);

        // Assert
        expect(result.error).toBeUndefined();
        expect(sendFn).toHaveBeenCalledTimes(1);
    });

    it('refuses another suppressed address', async () => {
        // Arrange
        const { mailer, sendFn } = buildMailer(async () => ({ success: true }));
        const { service } = buildService({ mailer, suppressed: ['x@example.com'] });

        // Act
        const result = await service.testSend(SENDER, { ...body, toEmail: 'X@example.com' });

        // Assert
        expect(result.error?.reason).toBe('DIRECT_EMAIL_RECIPIENT_SUPPRESSED');
        expect(sendFn).not.toHaveBeenCalled();
    });

    it('surfaces a provider failure', async () => {
        // Arrange
        const { mailer } = buildMailer(async () => ({
            success: false,
            error: 'sender not verified'
        }));
        const { service } = buildService({ mailer });

        // Act
        const result = await service.testSend(SENDER, body);

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.PROVIDER_ERROR);
        expect(result.error?.message).toContain('sender not verified');
    });
});

describe('DirectEmailMessageService reads and webhook', () => {
    it('renders the preview through the mailer with a sample opt-out link and writes nothing', async () => {
        // Arrange
        const { mailer } = buildMailer(async () => ({ success: true }));
        const { service, messageModel } = buildService({ mailer });

        // Act
        const result = await service.preview(SENDER, { subject: 'Hola', bodyJson: BODY });

        // Assert
        expect(result.data).toEqual({ subject: 'Hola', html: '<html>preview</html>' });
        expect(mailer.renderHtml).toHaveBeenCalledWith(
            expect.objectContaining({ isTest: false, subject: 'Hola' })
        );
        expect(messageModel.create).not.toHaveBeenCalled();
    });

    it('requires DIRECT_EMAIL_VIEW to preview', async () => {
        const { mailer } = buildMailer(async () => ({ success: true }));
        const { service } = buildService({ mailer });
        const result = await service.preview(buildActor([]), { subject: 'x', bodyJson: BODY });
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('checkRecipients lowercases, dedups and reports the suppressed subset', async () => {
        // Arrange
        const { service, suppressionModel } = buildService({ suppressed: ['a@example.com'] });

        // Act
        const result = await service.checkRecipients(SENDER, {
            emails: [' A@Example.com ', 'a@example.com', 'b@example.com']
        });

        // Assert
        expect(result.data).toEqual({ suppressed: ['a@example.com'] });
        expect(suppressionModel.findSuppressedEmails).toHaveBeenCalledWith(
            ['a@example.com', 'b@example.com'],
            undefined
        );
    });

    it('getById answers NOT_FOUND for an unknown message', async () => {
        const { service, messageModel } = buildService({});
        messageModel.findMessageById.mockResolvedValue(null);
        const result = await service.getById(SENDER, {
            id: '22222222-2222-4222-8222-222222222222'
        });
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('getById returns the message with its recipients', async () => {
        const { service, messageModel, recipientModel } = buildService({});
        messageModel.findMessageById.mockResolvedValue({ id: 'm' });
        recipientModel.findByMessageId.mockResolvedValue([{ email: 'a@example.com' }]);
        const result = await service.getById(SENDER, {
            id: '22222222-2222-4222-8222-222222222222'
        });
        expect(result.data).toEqual({ id: 'm', recipients: [{ email: 'a@example.com' }] });
    });

    it('applyProviderEvent updates the matched recipient and suppresses on hard bounce (AC-9)', async () => {
        // Arrange
        const { service, recipientModel, suppressionModel } = buildService({});
        recipientModel.findOne.mockResolvedValue({ email: 'a@example.com' });
        const at = new Date('2026-11-28T10:00:00Z');

        // Act
        const result = await service.applyProviderEvent({
            providerMessageId: '<id-1>',
            event: 'hard_bounce',
            at
        });

        // Assert
        expect(result).toEqual({ matched: true });
        expect(recipientModel.applyProviderEvent).toHaveBeenCalledWith({
            providerMessageId: '<id-1>',
            event: 'hard_bounce',
            at
        });
        expect(suppressionModel.insertIfAbsent).toHaveBeenCalledWith({
            email: 'a@example.com',
            reason: 'hard_bounce',
            createdBy: null
        });
    });

    it('applyProviderEvent does not suppress on a soft bounce or an open', async () => {
        const { service, recipientModel, suppressionModel } = buildService({});
        recipientModel.findOne.mockResolvedValue({ email: 'a@example.com' });
        for (const event of ['soft_bounce', 'opened', 'delivered'] as const) {
            await service.applyProviderEvent({ providerMessageId: '<id>', event, at: new Date() });
        }
        expect(suppressionModel.insertIfAbsent).not.toHaveBeenCalled();
    });

    it('applyProviderEvent ignores a message id that is not a direct email', async () => {
        const { service, recipientModel } = buildService({});
        recipientModel.findOne.mockResolvedValue(null);
        const result = await service.applyProviderEvent({
            providerMessageId: '<other>',
            event: 'delivered',
            at: new Date()
        });
        expect(result).toEqual({ matched: false });
        expect(recipientModel.applyProviderEvent).not.toHaveBeenCalled();
    });
});
