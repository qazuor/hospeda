/**
 * @module direct-email-message.service
 *
 * DirectEmailMessageService: composes, previews, test-sends and sends one-to-one emails
 * from the admin panel, and keeps their history (HOS-2685).
 *
 * Send is synchronous and sequential: one `mailer.send` per recipient, each recorded as
 * `sent`, `failed` or `suppressed`. It is idempotent per compose session (`idempotencyKey`)
 * and stops starting sends once the batch deadline passes. A failure on one recipient never stops the others
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
    buildDirectEmailFromName,
    findReplay,
    recordRecipient,
    sendRecipientsInOrder
} from './direct-email-send.helpers.js';
import {
    buildDirectEmailOptOutUrl,
    DIRECT_EMAIL_NON_FUNCTIONAL_OPT_OUT_TOKEN
} from './direct-email-token.helpers.js';

export { buildDirectEmailFromName } from './direct-email-send.helpers.js';

const IdInputSchema = z.object({ id: z.string().uuid() });

/** Subject prefix of a test send. */
const TEST_SUBJECT_PREFIX = '[PRUEBA] ';

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
    /** Clock in epoch milliseconds. Tests inject it to drive the batch deadline. */
    readonly now?: () => number;
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
 * Sends and records direct emails.
 *
 * @example
 * ```ts
 * const svc = new DirectEmailMessageService({ logger }, { mailer, resolveFromEmail, siteUrl });
 * const result = await svc.send(actor, { subject, bodyJson, recipients });
 * ```
 */
export class DirectEmailMessageService extends BaseService {
    static readonly ENTITY_NAME = 'directEmailMessage';
    protected override readonly entityName = DirectEmailMessageService.ENTITY_NAME;

    private readonly mailer: DirectEmailMailerPort | undefined;
    private readonly resolveFromEmail: () => string;
    private readonly now: () => number;
    private readonly siteUrl: string;
    private readonly messageModel: DirectEmailMessageModel;
    private readonly recipientModel: DirectEmailRecipientModel;
    private readonly suppressionModel: DirectEmailSuppressionModel;

    constructor(config: ServiceConfig, options: DirectEmailMessageServiceOptions = {}) {
        super(config, DirectEmailMessageService.ENTITY_NAME);
        this.mailer = options.mailer;
        this.resolveFromEmail = options.resolveFromEmail ?? (() => 'noreply@hospeda.com.ar');
        this.now = options.now ?? Date.now;
        this.siteUrl = options.siteUrl ?? 'https://hospeda.com.ar';
        this.messageModel = options.messageModel ?? new DirectEmailMessageModel();
        this.recipientModel = options.recipientModel ?? new DirectEmailRecipientModel();
        this.suppressionModel = options.suppressionModel ?? new DirectEmailSuppressionModel();
    }

    /** Returns the mailer or throws SERVICE_UNAVAILABLE. */
    private requireMailer(): DirectEmailMailerPort {
        if (!this.mailer) {
            throw new ServiceError(
                ServiceErrorCode.SERVICE_UNAVAILABLE,
                'Direct email delivery is not configured (mailer missing).',
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

    /** Opt-out URL carrying `token`. */
    private optOutUrlFor(token: string): string {
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
                    optOutUrl: this.optOutUrlFor(DIRECT_EMAIL_NON_FUNCTIONAL_OPT_OUT_TOKEN),
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
     * `[PRUEBA]` and with the warning banner. Creates no history row. Its opt-out link
     * is non-functional. The suppression
     * list is ignored only for the admin's own address; any other suppressed address is
     * refused. Requires `DIRECT_EMAIL_SEND`.
     *
     * @param actor - The admin actor
     * @param input - Subject, body and optional destination
     * @param ctx - Optional service context
     * @returns The address the test went to, and whether the provider accepted it
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
                    optOutUrl: this.optOutUrlFor(DIRECT_EMAIL_NON_FUNCTIONAL_OPT_OUT_TOKEN),
                    isTest: true,
                    fromEmail: this.resolveFromEmail(),
                    fromName: buildDirectEmailFromName(actor.name),
                    replyTo: senderEmail
                });
                if (!outcome.success) {
                    // Not thrown: a 502 is masked by the API's 5xx rule and the admin would
                    // never see the provider text (HOS-2685).
                    return {
                        sentTo: to,
                        delivered: false,
                        providerError: outcome.error ?? 'Unknown provider error'
                    };
                }
                return { sentTo: to, delivered: true, providerError: null };
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

                const replayed = await this.replayFor(actor, validated.idempotencyKey, resolved.tx);
                if (replayed) return replayed;

                const fromEmail = this.resolveFromEmail();
                const fromName = buildDirectEmailFromName(actor.name);
                const suppressed = new Set(
                    await this.suppressionModel.findSuppressedEmails(
                        validated.recipients,
                        resolved.tx
                    )
                );
                const startedAt = this.now();
                let message: { readonly id: string };
                try {
                    message = await this.messageModel.create(
                        {
                            subject: validated.subject,
                            bodyJson: validated.bodyJson,
                            templateId: validated.templateId ?? null,
                            sentBy: actor.id,
                            fromEmail,
                            replyToEmail: replyTo,
                            idempotencyKey: validated.idempotencyKey
                        },
                        resolved.tx
                    );
                } catch (error) {
                    // Two requests with the same key raced: the loser replays the winner.
                    const raced = await this.replayFor(
                        actor,
                        validated.idempotencyKey,
                        resolved.tx
                    );
                    if (raced) return raced;
                    throw error;
                }

                const results = await sendRecipientsInOrder({
                    recipients: validated.recipients,
                    suppressed,
                    mailer,
                    subject: validated.subject,
                    bodyJson: validated.bodyJson,
                    fromEmail,
                    fromName,
                    replyTo,
                    optOutUrlFor: (token) => this.optOutUrlFor(token),
                    now: this.now,
                    startedAt,
                    record: ({ result, optOutToken }) =>
                        recordRecipient({
                            recipientModel: this.recipientModel,
                            logger: this.logger,
                            messageId: message.id,
                            result,
                            optOutToken,
                            tx: resolved.tx
                        })
                });
                return { messageId: message.id, results };
            }
        });
    }

    /** The stored result of a send already made with this key, or `null` for a new key. */
    private replayFor(
        actor: Actor,
        idempotencyKey: string,
        tx: ServiceContext['tx']
    ): Promise<SendDirectEmailResponse | null> {
        return findReplay({
            messageModel: this.messageModel,
            recipientModel: this.recipientModel,
            idempotencyKey,
            actorId: actor.id,
            tx
        });
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
                // The opt-out token is a credential of the recipient's link: never returned.
                return {
                    ...message,
                    recipients: recipients.map(({ optOutToken: _omit, ...rest }) => rest)
                };
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
