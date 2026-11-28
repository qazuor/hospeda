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
import type { Actor } from '../../../src/types/index.js';

const KEY = '33333333-3333-4333-8333-333333333333';
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
        findMessageById: vi.fn(),
        findByIdempotencyKey: vi.fn(async (): Promise<Record<string, unknown> | null> => null)
    };
    const recipientModel = {
        create: vi.fn(async (data: Record<string, unknown>) => data),
        update: vi.fn(async () => null),
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
    now?: () => number;
}) => {
    const models = buildModels(input.suppressed);
    const service = new DirectEmailMessageService(
        {},
        {
            ...(input.mailer ? { mailer: input.mailer } : {}),
            resolveFromEmail: input.resolveFromEmail ?? (() => 'contacto@comercial.hospeda.com.ar'),
            ...(input.now ? { now: input.now } : {}),
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
        recipients: ['a@example.com', 'b@example.com', 'c@example.com'],
        idempotencyKey: KEY
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
        expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(first.optOutUrl).not.toContain('example.com');
        expect(recipientModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'a@example.com', optOutToken: token }),
            undefined
        );
        expect(messageModel.create).toHaveBeenCalledWith(
            expect.objectContaining({
                subject: 'Propuesta',
                sentBy: SENDER.id,
                fromEmail: 'contacto@comercial.hospeda.com.ar',
                replyToEmail: 'laura@hospeda.com.ar',
                idempotencyKey: KEY
            }),
            undefined
        );
        expect(recipientModel.create).toHaveBeenCalledTimes(3);
        const tokens = recipientModel.create.mock.calls.map(
            (call) => (call[0] as { optOutToken: string }).optOutToken
        );
        expect(new Set(tokens).size).toBe(3);
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
        const reserved = recipientModel.create.mock.calls.find(
            (call) => (call[0] as { email: string }).email === 'b@example.com'
        )?.[0] as { optOutToken: string };
        expect(recipientModel.update).toHaveBeenCalledWith(
            { optOutToken: reserved.optOutToken },
            expect.objectContaining({ status: 'failed', errorMessage: 'mailbox rejected' }),
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

    it('reserves each recipient row with its token BEFORE sending it', async () => {
        // Arrange
        const order: string[] = [];
        const { mailer } = buildMailer(async (input) => {
            order.push(`send:${input.to}`);
            return { success: true, messageId: 'ok' };
        });
        const { service, recipientModel } = buildService({ mailer });
        recipientModel.create.mockImplementation(async (data: Record<string, unknown>) => {
            order.push(`reserve:${String(data.email)}`);
            return data;
        });

        // Act
        await service.send(SENDER, { ...request, recipients: ['a@example.com'] });

        // Assert
        expect(order).toEqual(['reserve:a@example.com', 'send:a@example.com']);
        expect(recipientModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'failed', errorMessage: 'pending' }),
            undefined
        );
    });

    it('does not send a recipient whose row could not be reserved and reports record_failed', async () => {
        // Arrange: without a row the opt-out link in the email would resolve to nothing.
        const { mailer, sendFn } = buildMailer(async () => ({ success: true, messageId: 'ok' }));
        const { service, recipientModel } = buildService({ mailer });
        recipientModel.create.mockRejectedValueOnce(new Error('db down'));

        // Act
        const result = await service.send(SENDER, request);

        // Assert
        expect(result.data?.results.map((r) => [r.email, r.status, r.error])).toEqual([
            ['a@example.com', 'failed', 'record_failed'],
            ['b@example.com', 'sent', null],
            ['c@example.com', 'sent', null]
        ]);
        expect(sendFn.mock.calls.map((call) => (call[0] as DirectEmailMailInput).to)).toEqual([
            'b@example.com',
            'c@example.com'
        ]);
    });

    it('keeps the reserved row (so the link still resolves) when the post-send update fails', async () => {
        // Arrange
        const { mailer } = buildMailer(async () => ({ success: true, messageId: 'ok' }));
        const { service, recipientModel } = buildService({ mailer });
        recipientModel.update.mockRejectedValue(new Error('db down'));

        // Act
        const result = await service.send(SENDER, request);

        // Assert
        expect(result.data?.results.map((r) => r.status)).toEqual(['sent', 'sent', 'sent']);
        expect(recipientModel.create).toHaveBeenCalledTimes(3);
        const sentToken = new URL(
            (mailer.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0].optOutUrl
        ).searchParams.get('token');
        expect(recipientModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'a@example.com', optOutToken: sentToken }),
            undefined
        );
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

describe('DirectEmailMessageService.send idempotency and batch deadline (HOS-2685)', () => {
    const request = {
        subject: 'Propuesta',
        bodyJson: BODY,
        recipients: ['a@example.com', 'b@example.com', 'c@example.com'],
        idempotencyKey: KEY
    };

    it('replays the stored result and sends nothing when the key was already used', async () => {
        // Arrange
        const { mailer, sendFn } = buildMailer(async () => ({ success: true, messageId: 'ok' }));
        const { service, messageModel, recipientModel } = buildService({ mailer });
        messageModel.findByIdempotencyKey.mockResolvedValue({ id: 'msg-old', sentBy: SENDER.id });
        recipientModel.findByMessageId.mockResolvedValue([
            {
                email: 'a@example.com',
                status: 'delivered',
                providerMessageId: '<a>',
                errorMessage: null
            },
            {
                email: 'b@example.com',
                status: 'failed',
                providerMessageId: null,
                errorMessage: 'rejected'
            },
            {
                email: 'c@example.com',
                status: 'suppressed',
                providerMessageId: null,
                errorMessage: null
            }
        ]);

        // Act
        const result = await service.send(SENDER, request);

        // Assert
        expect(sendFn).not.toHaveBeenCalled();
        expect(messageModel.create).not.toHaveBeenCalled();
        expect(result.data).toEqual({
            messageId: 'msg-old',
            results: [
                { email: 'a@example.com', status: 'sent', providerMessageId: '<a>', error: null },
                {
                    email: 'b@example.com',
                    status: 'failed',
                    providerMessageId: null,
                    error: 'rejected'
                },
                {
                    email: 'c@example.com',
                    status: 'suppressed',
                    providerMessageId: null,
                    error: null
                }
            ]
        });
    });

    it('refuses a key that another admin used', async () => {
        const { mailer, sendFn } = buildMailer(async () => ({ success: true }));
        const { service, messageModel } = buildService({ mailer });
        messageModel.findByIdempotencyKey.mockResolvedValue({
            id: 'msg-old',
            sentBy: 'someone-else'
        });

        const result = await service.send(SENDER, request);

        expect(result.error?.reason).toBe('DIRECT_EMAIL_IDEMPOTENCY_KEY_CONFLICT');
        expect(sendFn).not.toHaveBeenCalled();
    });

    it('replays the winner when two sends with the same key race on the insert', async () => {
        // Arrange
        const { mailer, sendFn } = buildMailer(async () => ({ success: true }));
        const { service, messageModel, recipientModel } = buildService({ mailer });
        messageModel.findByIdempotencyKey
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'msg-winner', sentBy: SENDER.id });
        messageModel.create.mockRejectedValueOnce(new Error('duplicate key value'));
        recipientModel.findByMessageId.mockResolvedValue([]);

        // Act
        const result = await service.send(SENDER, request);

        // Assert
        expect(result.data?.messageId).toBe('msg-winner');
        expect(sendFn).not.toHaveBeenCalled();
    });

    it('requires an idempotency key', async () => {
        const { mailer } = buildMailer(async () => ({ success: true }));
        const { service } = buildService({ mailer });
        const { idempotencyKey: _key, ...withoutKey } = request;

        const result = await service.send(SENDER, withoutKey as never);

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('stops starting recipients after 75 seconds and reports the rest as failed with timeout', async () => {
        // Arrange: the clock jumps past the deadline while the first recipient is being sent.
        let clock = 0;
        const { mailer, sendFn } = buildMailer(async () => {
            clock += 80_000;
            return { success: true, messageId: 'ok' };
        });
        const { service, recipientModel } = buildService({ mailer, now: () => clock });

        // Act
        const result = await service.send(SENDER, request);

        // Assert
        expect(sendFn).toHaveBeenCalledTimes(1);
        expect(result.data?.results.map((r) => [r.status, r.error])).toEqual([
            ['sent', null],
            ['failed', 'timeout'],
            ['failed', 'timeout']
        ]);
        expect(recipientModel.create).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'c@example.com',
                status: 'failed',
                errorMessage: 'timeout'
            }),
            undefined
        );
    });

    it('still reports suppressed addresses as suppressed after the deadline', async () => {
        let clock = 0;
        const { mailer } = buildMailer(async () => {
            clock += 80_000;
            return { success: true, messageId: 'ok' };
        });
        const { service } = buildService({
            mailer,
            suppressed: ['b@example.com'],
            now: () => clock
        });

        const result = await service.send(SENDER, request);

        expect(result.data?.results.map((r) => r.status)).toEqual(['sent', 'suppressed', 'failed']);
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
        expect(result.data).toEqual({
            sentTo: 'laura@hospeda.com.ar',
            delivered: true,
            providerError: null
        });
        const input = sendFn.mock.calls[0]?.[0] as DirectEmailMailInput;
        expect(input.subject).toBe('[PRUEBA] Hola');
        expect(new URL(input.optOutUrl).searchParams.get('token')).toBe('test');
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

    it('reports a provider failure with its text instead of throwing (a 502 would be masked)', async () => {
        // Arrange
        const { mailer } = buildMailer(async () => ({
            success: false,
            error: 'sender not verified'
        }));
        const { service } = buildService({ mailer });

        // Act
        const result = await service.testSend(SENDER, body);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({
            sentTo: 'laura@hospeda.com.ar',
            delivered: false,
            providerError: 'sender not verified'
        });
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
        expect(
            new URL(
                (vi.mocked(mailer.renderHtml).mock.calls[0]?.[0] as { optOutUrl: string }).optOutUrl
            ).searchParams.get('token')
        ).toBe('test');
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
        recipientModel.findByMessageId.mockResolvedValue([
            { email: 'a@example.com', optOutToken: 'secret-token' }
        ]);
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
