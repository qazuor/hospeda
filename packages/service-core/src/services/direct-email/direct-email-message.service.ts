/**
 * @module direct-email-message.service
 *
 * DirectEmailMessageService: composes, previews, test-sends and sends one-to-one emails
 * from the admin panel, and keeps their history (HOS-2685).
 *
 * Send is synchronous and sequential: one `mailer.send` per recipient, each recorded as
 * `sent`, `failed` or `suppressed`. A failure on one recipient never stops the others
 * (AC-2, AC-4). The mailer and the From resolution are injected, so tests send nothing.
 */

import {
    DirectEmailMessageModel,
    DirectEmailRecipientModel,
    DirectEmailSuppressionModel
} from '@repo/db';
import type {
    CheckDirectEmailRecipientsResponse,
    DirectEmailMessageDetail,
    DirectEmailMessageListItem,
    PreviewDirectEmailResponse,
    SendDirectEmailResponse,
    TestSendDirectEmailResponse
} from '@repo/schemas';
import {
    CheckDirectEmailRecipientsRequestSchema,
    DirectEmailAdminSearchSchema,
    DirectEmailRecipientStatusEnum,
    DirectEmailSuppressionReasonEnum,
    PreviewDirectEmailRequestSchema,
    SendDirectEmailRequestSchema,
    ServiceErrorCode,
    TestSendDirectEmailRequestSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { checkCanSendDirectEmail, checkCanViewDirectEmail } from './direct-email.permissions.js';
import type { DirectEmailMailerPort } from './direct-email.ports.js';
import {
    buildDirectEmailOptOutUrl,
    generateDirectEmailOptOutToken
} from './direct-email-token.helpers.js';

const IdInputSchema = z.object({ id: z.string().uuid() });

/** Subject prefix of a test send. */
const TEST_SUBJECT_PREFIX = '[PRUEBA] ';

/** Address the preview signs its sample opt-out link for. Never a real person. */
const PREVIEW_SAMPLE_EMAIL = 'destinatario@ejemplo.com';

/** Recipient row status written for each send result. */
const RECIPIENT_STATUS_BY_RESULT = {
    sent: DirectEmailRecipientStatusEnum.SENT,
    failed: DirectEmailRecipientStatusEnum.FAILED,
    suppressed: DirectEmailRecipientStatusEnum.SUPPRESSED
} as const;

/** Provider events the webhook maps onto a recipient row. */
export type DirectEmailWebhookEvent = 'delivered' | 'opened' | 'hard_bounce' | 'soft_bounce';

/** Constructor options of {@link DirectEmailMessageService}. */
export interface DirectEmailMessageServiceOptions {
    /** Renders and sends. Required for preview and sends. */
    readonly mailer?: DirectEmailMailerPort;
    /**
     * Resolves the From address of a send: `HOSPEDA_DIRECT_EMAIL_FROM_EMAIL` when set,
     * else the current sender (`getEmailSender()`).
     */
    readonly resolveFromEmail?: () => string;
    /** HMAC secret of the opt-out tokens (`HOSPEDA_NEWSLETTER_HMAC_SECRET`). */
    readonly hmacSecret?: string;
    /** Web origin the opt-out page lives on. */
    readonly siteUrl?: string;
    readonly messageModel?: DirectEmailMessageModel;
    readonly recipientModel?: DirectEmailRecipientModel;
    readonly suppressionModel?: DirectEmailSuppressionModel;
}

/** Page of history rows. */
export interface DirectEmailMessagePage {
    readonly items: readonly DirectEmailMessageListItem[];
    readonly total: number;
}

/**
 * Display name of the sender: `<first name> de Hospeda`, or `Hospeda` when the admin has
 * no name on file.
 *
 * @param name - The actor's display name
 * @returns The From display name, before any environment marker
 */
export function buildDirectEmailFromName(name: string | undefined): string {
    const first = name?.trim().split(/\s+/)[0];
    return first ? `${first} de Hospeda` : 'Hospeda';
}

/**
 * Sends and records direct emails.
 *
 * @example
 * ```ts
 * const svc = new DirectEmailMessageService({ logger }, { mailer, resolveFromEmail, hmacSecret, siteUrl });
 * const result = await svc.send(actor, { subject, bodyJson, recipients });
 * ```
 */
export class DirectEmailMessageService extends BaseService {
    static readonly ENTITY_NAME = 'directEmailMessage';
    protected override readonly entityName = DirectEmailMessageService.ENTITY_NAME;

    private readonly mailer: DirectEmailMailerPort | undefined;
    private readonly resolveFromEmail: () => string;
    private readonly hmacSecret: string;
    private readonly siteUrl: string;
    private readonly messageModel: DirectEmailMessageModel;
    private readonly recipientModel: DirectEmailRecipientModel;
    private readonly suppressionModel: DirectEmailSuppressionModel;

    constructor(config: ServiceConfig, options: DirectEmailMessageServiceOptions = {}) {
        super(config, DirectEmailMessageService.ENTITY_NAME);
        this.mailer = options.mailer;
        this.resolveFromEmail = options.resolveFromEmail ?? (() => 'noreply@hospeda.com.ar');
        this.hmacSecret = options.hmacSecret ?? '';
        this.siteUrl = options.siteUrl ?? 'https://hospeda.com.ar';
        this.messageModel = options.messageModel ?? new DirectEmailMessageModel();
        this.recipientModel = options.recipientModel ?? new DirectEmailRecipientModel();
        this.suppressionModel = options.suppressionModel ?? new DirectEmailSuppressionModel();
    }

    /** Returns the mailer or throws SERVICE_UNAVAILABLE. */
    private requireMailer(): DirectEmailMailerPort {
        if (!this.mailer || !this.hmacSecret) {
            throw new ServiceError(
                ServiceErrorCode.SERVICE_UNAVAILABLE,
                'Direct email delivery is not configured (mailer or HMAC secret missing).',
                undefined,
                'DIRECT_EMAIL_NOT_CONFIGURED'
            );
        }
        return this.mailer;
    }

    /** The admin's own address, required as Reply-To. */
    private requireSenderEmail(actor: Actor): string {
        const email = actor.email?.trim().toLowerCase();
        if (!email) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'The sending admin has no email on file.',
                undefined,
                'DIRECT_EMAIL_SENDER_EMAIL_MISSING'
            );
        }
        return email;
    }

    /** Signed opt-out URL of one recipient. */
    private optOutUrlFor(email: string): string {
        const token = generateDirectEmailOptOutToken({ email, secret: this.hmacSecret });
        return buildDirectEmailOptOutUrl({ siteUrl: this.siteUrl, token });
    }

    /**
     * Renders the exact HTML a recipient would get, with a sample opt-out link.
     * Requires `DIRECT_EMAIL_VIEW`. Sends and writes nothing.
     *
     * @param actor - The admin actor
     * @param input - Subject and TipTap body (may still be empty while composing)
     * @param ctx - Optional service context
     * @returns The subject and the full HTML
     */
    public async preview(
        actor: Actor,
        input: z.input<typeof PreviewDirectEmailRequestSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PreviewDirectEmailResponse>> {
        return this.runWithLoggingAndValidation({
            methodName: 'preview',
            input: { actor, ...input },
            schema: PreviewDirectEmailRequestSchema,
            ctx,
            execute: async (validated) => {
                checkCanViewDirectEmail(actor);
                const mailer = this.requireMailer();
                const html = await mailer.renderHtml({
                    subject: validated.subject,
                    bodyJson: validated.bodyJson,
                    optOutUrl: this.optOutUrlFor(PREVIEW_SAMPLE_EMAIL),
                    isTest: false
                });
                return { subject: validated.subject, html };
            }
        });
    }

    /**
     * Reports which of the typed addresses are suppressed. Requires `DIRECT_EMAIL_VIEW`.
     * Addresses are matched lowercased and trimmed; malformed ones simply never match.
     *
     * @param actor - The admin actor
     * @param input - The typed addresses
     * @param ctx - Optional service context
     * @returns The suppressed subset, lowercased
     */
    public async checkRecipients(
        actor: Actor,
        input: z.input<typeof CheckDirectEmailRecipientsRequestSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<CheckDirectEmailRecipientsResponse>> {
        return this.runWithLoggingAndValidation({
            methodName: 'checkRecipients',
            input: { actor, ...input },
            schema: CheckDirectEmailRecipientsRequestSchema,
            ctx,
            execute: async (validated, _actor, resolved) => {
                checkCanViewDirectEmail(actor);
                const emails = [...new Set(validated.emails.map((e) => e.trim().toLowerCase()))];
                const suppressed = await this.suppressionModel.findSuppressedEmails(
                    emails,
                    resolved.tx
                );
                return { suppressed };
            }
        });
    }

    /**
     * Sends a test email to one address (default: the admin's own), subject prefixed
     * `[PRUEBA]` and with the warning banner. Creates no history row. The suppression
     * list is ignored only for the admin's own address; any other suppressed address is
     * refused. Requires `DIRECT_EMAIL_SEND`.
     *
     * @param actor - The admin actor
     * @param input - Subject, body and optional destination
     * @param ctx - Optional service context
     * @returns The address the test went to
     */
    public async testSend(
        actor: Actor,
        input: z.input<typeof TestSendDirectEmailRequestSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TestSendDirectEmailResponse>> {
        return this.runWithLoggingAndValidation({
            methodName: 'testSend',
            input: { actor, ...input },
            schema: TestSendDirectEmailRequestSchema,
            ctx,
            execute: async (validated, _actor, resolved) => {
                checkCanSendDirectEmail(actor);
                const mailer = this.requireMailer();
                const senderEmail = this.requireSenderEmail(actor);
                const to = validated.toEmail ?? senderEmail;
                if (to !== senderEmail) {
                    const suppressed = await this.suppressionModel.findSuppressedEmails(
                        [to],
                        resolved.tx
                    );
                    if (suppressed.length > 0) {
                        throw new ServiceError(
                            ServiceErrorCode.ALREADY_EXISTS,
                            'That address is on the suppression list.',
                            undefined,
                            'DIRECT_EMAIL_RECIPIENT_SUPPRESSED'
                        );
                    }
                }
                const outcome = await mailer.send({
                    to,
                    subject: `${TEST_SUBJECT_PREFIX}${validated.subject}`,
                    bodyJson: validated.bodyJson,
                    optOutUrl: this.optOutUrlFor(to),
                    isTest: true,
                    fromEmail: this.resolveFromEmail(),
                    fromName: buildDirectEmailFromName(actor.name),
                    replyTo: senderEmail
                });
                if (!outcome.success) {
                    throw new ServiceError(
                        ServiceErrorCode.PROVIDER_ERROR,
                        `Test send failed: ${outcome.error ?? 'unknown provider error'}`,
                        undefined,
                        'DIRECT_EMAIL_TEST_SEND_FAILED'
                    );
                }
                return { sentTo: to };
            }
        });
    }

    /**
     * Sends one message per recipient, sequentially, and records the history.
     * Suppressed addresses are skipped and reported as `suppressed`; a provider failure
     * on one recipient is recorded as `failed` and the rest are still sent. Requires
     * `DIRECT_EMAIL_SEND`. Validation (addresses, duplicates, limit, subject, body)
     * happens before anything is written or sent.
     *
     * @param actor - The admin actor (its email becomes Reply-To, its name the From name)
     * @param input - Subject, body, recipients and the template it started from
     * @param ctx - Optional service context
     * @returns The message id and one result per recipient, in request order
     */
    public async send(
        actor: Actor,
        input: z.input<typeof SendDirectEmailRequestSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<SendDirectEmailResponse>> {
        return this.runWithLoggingAndValidation({
            methodName: 'send',
            input: { actor, ...input },
            schema: SendDirectEmailRequestSchema,
            ctx,
            execute: async (validated, _actor, resolved) => {
                checkCanSendDirectEmail(actor);
                const mailer = this.requireMailer();
                const replyTo = this.requireSenderEmail(actor);
                const fromEmail = this.resolveFromEmail();
                const fromName = buildDirectEmailFromName(actor.name);
                const suppressed = new Set(
                    await this.suppressionModel.findSuppressedEmails(
                        validated.recipients,
                        resolved.tx
                    )
                );
                const message = await this.messageModel.create(
                    {
                        subject: validated.subject,
                        bodyJson: validated.bodyJson,
                        templateId: validated.templateId ?? null,
                        sentBy: actor.id,
                        fromEmail,
                        replyToEmail: replyTo
                    },
                    resolved.tx
                );

                const results: SendDirectEmailResponse['results'] = [];
                for (const email of validated.recipients) {
                    const result = suppressed.has(email)
                        ? this.suppressedResult(email)
                        : await this.sendToOne({
                              mailer,
                              email,
                              subject: validated.subject,
                              bodyJson: validated.bodyJson,
                              fromEmail,
                              fromName,
                              replyTo
                          });
                    results.push(result);
                    await this.recordRecipient({ messageId: message.id, result, ctx: resolved });
                }
                return { messageId: message.id, results };
            }
        });
    }

    /** Result of a skipped, suppressed recipient. */
    private suppressedResult(email: string): SendDirectEmailResponse['results'][number] {
        return { email, status: 'suppressed', providerMessageId: null, error: null };
    }

    /** Sends to one recipient; a throwing mailer counts as a failed send. */
    private async sendToOne(input: {
        readonly mailer: DirectEmailMailerPort;
        readonly email: string;
        readonly subject: string;
        readonly bodyJson: z.infer<typeof SendDirectEmailRequestSchema>['bodyJson'];
        readonly fromEmail: string;
        readonly fromName: string;
        readonly replyTo: string;
    }): Promise<SendDirectEmailResponse['results'][number]> {
        const { mailer, email } = input;
        try {
            const outcome = await mailer.send({
                to: email,
                subject: input.subject,
                bodyJson: input.bodyJson,
                optOutUrl: this.optOutUrlFor(email),
                isTest: false,
                fromEmail: input.fromEmail,
                fromName: input.fromName,
                replyTo: input.replyTo
            });
            if (outcome.success) {
                return {
                    email,
                    status: 'sent',
                    providerMessageId: outcome.messageId ?? null,
                    error: null
                };
            }
            return {
                email,
                status: 'failed',
                providerMessageId: null,
                error: outcome.error ?? 'Unknown provider error'
            };
        } catch (error) {
            return {
                email,
                status: 'failed',
                providerMessageId: null,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Writes the recipient row. A failed write is logged, never thrown: the mail already
     * left (or was skipped) and the remaining recipients must still be processed.
     */
    private async recordRecipient(input: {
        readonly messageId: string;
        readonly result: SendDirectEmailResponse['results'][number];
        readonly ctx: ServiceContext;
    }): Promise<void> {
        const { messageId, result, ctx } = input;
        const sent = result.status === 'sent';
        try {
            await this.recipientModel.create(
                {
                    messageId,
                    email: result.email,
                    status: RECIPIENT_STATUS_BY_RESULT[result.status],
                    providerMessageId: result.providerMessageId,
                    errorMessage: result.error,
                    sentAt: sent ? new Date() : null,
                    deliveredAt: null,
                    openedAt: null,
                    bouncedAt: null
                },
                ctx.tx
            );
        } catch (error) {
            this.logger.error(
                `Failed to record direct email recipient (message ${messageId}, status ${result.status}): ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Lists the history, newest first. Requires `DIRECT_EMAIL_VIEW`.
     *
     * @param actor - The admin actor
     * @param input - Page, page size and optional subject search
     * @param ctx - Optional service context
     * @returns The page and the total
     */
    public async list(
        actor: Actor,
        input: z.input<typeof DirectEmailAdminSearchSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<DirectEmailMessagePage>> {
        return this.runWithLoggingAndValidation({
            methodName: 'list',
            input: { actor, ...input },
            schema: DirectEmailAdminSearchSchema,
            ctx,
            execute: async (validated, _actor, resolved) => {
                checkCanViewDirectEmail(actor);
                return this.messageModel.findPageWithRecipientCount(
                    {
                        page: validated.page,
                        pageSize: validated.pageSize,
                        ...(validated.search ? { search: validated.search } : {})
                    },
                    resolved.tx
                );
            }
        });
    }

    /**
     * Reads one message with its recipients. Requires `DIRECT_EMAIL_VIEW`.
     *
     * @param actor - The admin actor
     * @param input - The message id
     * @param ctx - Optional service context
     * @returns The message and its recipients
     */
    public async getById(
        actor: Actor,
        input: z.input<typeof IdInputSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<DirectEmailMessageDetail>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getById',
            input: { actor, ...input },
            schema: IdInputSchema,
            ctx,
            execute: async (validated, _actor, resolved) => {
                checkCanViewDirectEmail(actor);
                const message = await this.messageModel.findMessageById(validated.id, resolved.tx);
                if (!message) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Direct email not found: ${validated.id}`,
                        undefined,
                        'DIRECT_EMAIL_NOT_FOUND'
                    );
                }
                const recipients = await this.recipientModel.findByMessageId(
                    validated.id,
                    resolved.tx
                );
                return { ...message, recipients };
            }
        });
    }

    /**
     * Applies a Brevo webhook event to the recipient with that provider message id
     * (AC-9). System call: no actor. A hard bounce also suppresses the address.
     * Idempotent and a no-op for a message id that is not a direct email.
     *
     * @param input.providerMessageId - Brevo message id of the event
     * @param input.event - `delivered`, `opened`, `hard_bounce` or `soft_bounce`
     * @param input.at - Event time
     * @returns Whether a direct email recipient matched
     */
    public async applyProviderEvent(input: {
        readonly providerMessageId: string;
        readonly event: DirectEmailWebhookEvent;
        readonly at: Date;
    }): Promise<{ readonly matched: boolean }> {
        const recipient = await this.recipientModel.findOne({
            providerMessageId: input.providerMessageId
        });
        if (!recipient) return { matched: false };
        await this.recipientModel.applyProviderEvent(input);
        if (input.event === 'hard_bounce') {
            await this.suppressionModel.insertIfAbsent({
                email: recipient.email,
                reason: DirectEmailSuppressionReasonEnum.HARD_BOUNCE,
                createdBy: null
            });
        }
        return { matched: true };
    }
}
