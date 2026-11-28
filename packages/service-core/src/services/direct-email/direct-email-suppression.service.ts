/**
 * @module direct-email-suppression.service
 *
 * DirectEmailSuppressionService: the suppression list of the direct email module
 * (HOS-2685). Addresses on it are never sent to again.
 *
 * - Admin: list (VIEW), add by hand and remove (SEND).
 * - Public opt-out: `previewOptOut` validates a footer-link token and returns the masked
 *   address without writing; `optOut` writes the suppression. Neither takes an actor.
 * - System: `addFromHardBounce`, called by the Brevo webhook.
 */

import { DirectEmailSuppressionModel } from '@repo/db';
import type { DirectEmailSuppression } from '@repo/schemas';
import {
    CreateDirectEmailSuppressionSchema,
    DirectEmailAdminSearchSchema,
    DirectEmailSuppressionReasonEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { checkCanSendDirectEmail, checkCanViewDirectEmail } from './direct-email.permissions.js';
import {
    DirectEmailTokenError,
    maskEmail,
    verifyDirectEmailOptOutToken
} from './direct-email-token.helpers.js';

const ListInputSchema = DirectEmailAdminSearchSchema.extend({
    reason: z.nativeEnum(DirectEmailSuppressionReasonEnum).optional()
});
const AddInputSchema = CreateDirectEmailSuppressionSchema;
const RemoveInputSchema = z.object({ id: z.string().uuid() });

/** Constructor options of {@link DirectEmailSuppressionService}. */
export interface DirectEmailSuppressionServiceOptions {
    /** HMAC secret of the opt-out tokens (`HOSPEDA_NEWSLETTER_HMAC_SECRET`). */
    readonly hmacSecret?: string;
    /** Previous secret, accepted during a rotation. */
    readonly hmacSecretPrev?: string;
    /** Model override, for tests. */
    readonly model?: DirectEmailSuppressionModel;
}

/** Page of suppressions. */
export interface DirectEmailSuppressionPage {
    readonly items: readonly DirectEmailSuppression[];
    readonly total: number;
}

/**
 * Manages the direct email suppression list.
 *
 * @example
 * ```ts
 * const svc = new DirectEmailSuppressionService({ logger }, { hmacSecret });
 * const result = await svc.optOut({ token });
 * ```
 */
export class DirectEmailSuppressionService extends BaseService {
    static readonly ENTITY_NAME = 'directEmailSuppression';
    protected override readonly entityName = DirectEmailSuppressionService.ENTITY_NAME;

    private readonly model: DirectEmailSuppressionModel;
    private readonly hmacSecret: string;
    private readonly hmacSecretPrev: string | undefined;

    constructor(config: ServiceConfig, options: DirectEmailSuppressionServiceOptions = {}) {
        super(config, DirectEmailSuppressionService.ENTITY_NAME);
        this.model = options.model ?? new DirectEmailSuppressionModel();
        this.hmacSecret = options.hmacSecret ?? '';
        this.hmacSecretPrev = options.hmacSecretPrev;
    }

    /**
     * Lists the suppressed addresses, newest first. Requires `DIRECT_EMAIL_VIEW`.
     *
     * @param actor - The admin actor
     * @param input - Page, page size, optional address search and reason filter
     * @param ctx - Optional service context
     * @returns The page and the total
     */
    public async list(
        actor: Actor,
        input: z.input<typeof ListInputSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<DirectEmailSuppressionPage>> {
        return this.runWithLoggingAndValidation({
            methodName: 'list',
            input: { actor, ...input },
            schema: ListInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanViewDirectEmail(actor);
                return this.model.findPage({
                    page: validated.page,
                    pageSize: validated.pageSize,
                    ...(validated.search ? { search: validated.search } : {}),
                    ...(validated.reason ? { reason: validated.reason } : {})
                });
            }
        });
    }

    /**
     * Adds an address by hand (reason `manual`). Idempotent: an address already on the
     * list is returned as is. Requires `DIRECT_EMAIL_SEND`.
     *
     * @param actor - The admin actor
     * @param input - The address
     * @param ctx - Optional service context
     * @returns The suppression row
     */
    public async add(
        actor: Actor,
        input: z.input<typeof AddInputSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<DirectEmailSuppression>> {
        return this.runWithLoggingAndValidation({
            methodName: 'add',
            input: { actor, ...input },
            schema: AddInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanSendDirectEmail(actor);
                const { suppression } = await this.model.insertIfAbsent(
                    {
                        email: validated.email,
                        reason: DirectEmailSuppressionReasonEnum.MANUAL,
                        createdBy: actor.id
                    },
                    ctx?.tx
                );
                return suppression;
            }
        });
    }

    /**
     * Removes an address from the list. Requires `DIRECT_EMAIL_SEND`.
     *
     * @param actor - The admin actor
     * @param input - The suppression id
     * @param ctx - Optional service context
     * @returns `{ id }` of the removed row
     * @throws NOT_FOUND (as a service error output) when no such row exists
     */
    public async remove(
        actor: Actor,
        input: z.input<typeof RemoveInputSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ id: string }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'remove',
            input: { actor, ...input },
            schema: RemoveInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanSendDirectEmail(actor);
                const deleted = await this.model.hardDelete({ id: validated.id }, ctx?.tx);
                if (deleted === 0) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Suppression not found: ${validated.id}`,
                        undefined,
                        'DIRECT_EMAIL_SUPPRESSION_NOT_FOUND'
                    );
                }
                return { id: validated.id };
            }
        });
    }

    /**
     * Validates an opt-out token and returns the masked address. Writes nothing, so a
     * link scanner that opens the page cannot unsubscribe anybody.
     *
     * @param input.token - Token from the footer link
     * @returns The masked address
     */
    public async previewOptOut(input: {
        readonly token: string;
    }): Promise<ServiceOutput<{ maskedEmail: string }>> {
        try {
            const { email } = this.verifyToken(input.token);
            return { data: { maskedEmail: maskEmail(email) } };
        } catch (error) {
            return { error: this.toServiceError(error) };
        }
    }

    /**
     * Adds the address of a valid opt-out token to the list (reason `opt_out`).
     * Idempotent: visiting the link twice is harmless.
     *
     * @param input.token - Token from the footer link
     * @returns The masked address
     */
    public async optOut(input: {
        readonly token: string;
    }): Promise<ServiceOutput<{ maskedEmail: string }>> {
        try {
            const { email } = this.verifyToken(input.token);
            await this.model.insertIfAbsent({
                email,
                reason: DirectEmailSuppressionReasonEnum.OPT_OUT,
                createdBy: null
            });
            return { data: { maskedEmail: maskEmail(email) } };
        } catch (error) {
            return { error: this.toServiceError(error) };
        }
    }

    /**
     * Adds an address after a provider hard bounce (reason `hard_bounce`). System call
     * from the Brevo webhook: no actor. Idempotent.
     *
     * @param input.email - The bounced address (lowercased here)
     * @returns Whether this call created the row
     */
    public async addFromHardBounce(input: {
        readonly email: string;
    }): Promise<{ readonly created: boolean }> {
        const { created } = await this.model.insertIfAbsent({
            email: input.email.trim().toLowerCase(),
            reason: DirectEmailSuppressionReasonEnum.HARD_BOUNCE,
            createdBy: null
        });
        return { created };
    }

    /** Verifies a token with the configured secrets. */
    private verifyToken(token: string): { readonly email: string } {
        if (!this.hmacSecret) {
            throw new ServiceError(
                ServiceErrorCode.SERVICE_UNAVAILABLE,
                'Direct email opt-out is not configured (HMAC secret missing)',
                undefined,
                'DIRECT_EMAIL_OPT_OUT_NOT_CONFIGURED'
            );
        }
        return verifyDirectEmailOptOutToken({
            token,
            secret: this.hmacSecret,
            ...(this.hmacSecretPrev ? { secretPrev: this.hmacSecretPrev } : {})
        });
    }

    /** Maps a thrown value to a {@link ServiceError}. A bad token is a 400-class input error. */
    private toServiceError(error: unknown): ServiceError {
        if (error instanceof ServiceError) return error;
        if (error instanceof DirectEmailTokenError) {
            return new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'The opt-out link is not valid',
                undefined,
                'DIRECT_EMAIL_TOKEN_INVALID'
            );
        }
        return new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`,
            error
        );
    }
}
