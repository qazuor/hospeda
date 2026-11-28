/**
 * @module direct-email-template.service
 *
 * DirectEmailTemplateService: CRUD of the reusable direct email templates (HOS-2685).
 * Templates are plain data (name, subject, TipTap body) so the CRM (HOS-2686) can read
 * the same rows over the API. Reads need `DIRECT_EMAIL_VIEW`; writes need
 * `DIRECT_EMAIL_TEMPLATE_WRITE`. Delete is soft.
 */

import { DirectEmailTemplateModel } from '@repo/db';
import type { DirectEmailTemplate } from '@repo/schemas';
import {
    CreateDirectEmailTemplateSchema,
    DirectEmailTemplateAdminSearchSchema,
    ServiceErrorCode,
    UpdateDirectEmailTemplateSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import {
    checkCanViewDirectEmail,
    checkCanWriteDirectEmailTemplate
} from './direct-email.permissions.js';

const IdInputSchema = z.object({ id: z.string().uuid() });
const UpdateInputSchema = z.object({
    id: z.string().uuid(),
    data: UpdateDirectEmailTemplateSchema
});

/** Constructor options of {@link DirectEmailTemplateService}. */
export interface DirectEmailTemplateServiceOptions {
    /** Model override, for tests. */
    readonly model?: DirectEmailTemplateModel;
}

/** Page of templates. */
export interface DirectEmailTemplatePage {
    readonly items: readonly DirectEmailTemplate[];
    readonly total: number;
}

/**
 * Manages direct email templates.
 *
 * @example
 * ```ts
 * const svc = new DirectEmailTemplateService({ logger });
 * const created = await svc.create(actor, { name, subject, bodyJson });
 * ```
 */
export class DirectEmailTemplateService extends BaseService {
    static readonly ENTITY_NAME = 'directEmailTemplate';
    protected override readonly entityName = DirectEmailTemplateService.ENTITY_NAME;

    private readonly model: DirectEmailTemplateModel;

    constructor(config: ServiceConfig, options: DirectEmailTemplateServiceOptions = {}) {
        super(config, DirectEmailTemplateService.ENTITY_NAME);
        this.model = options.model ?? new DirectEmailTemplateModel();
    }

    /** Throws NOT_FOUND unless a live template with `id` exists. */
    private async requireLive(id: string, ctx: ServiceContext): Promise<DirectEmailTemplate> {
        const template = await this.model.findLiveById(id, ctx.tx);
        if (!template) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `Direct email template not found: ${id}`,
                undefined,
                'DIRECT_EMAIL_TEMPLATE_NOT_FOUND'
            );
        }
        return template;
    }

    /**
     * Lists live templates, most recently edited first. Requires `DIRECT_EMAIL_VIEW`.
     *
     * @param actor - The admin actor
     * @param input - Page, page size and optional name search
     * @param ctx - Optional service context
     * @returns The page and the total
     */
    public async list(
        actor: Actor,
        input: z.input<typeof DirectEmailTemplateAdminSearchSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<DirectEmailTemplatePage>> {
        return this.runWithLoggingAndValidation({
            methodName: 'list',
            input: { actor, ...input },
            schema: DirectEmailTemplateAdminSearchSchema,
            ctx,
            execute: async (validated, _actor, resolved) => {
                checkCanViewDirectEmail(actor);
                return this.model.findLivePage(
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
     * Reads one live template. Requires `DIRECT_EMAIL_VIEW`.
     *
     * @param actor - The admin actor
     * @param input - The template id
     * @param ctx - Optional service context
     * @returns The template
     */
    public async getById(
        actor: Actor,
        input: z.input<typeof IdInputSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<DirectEmailTemplate>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getById',
            input: { actor, ...input },
            schema: IdInputSchema,
            ctx,
            execute: async (validated, _actor, resolved) => {
                checkCanViewDirectEmail(actor);
                return this.requireLive(validated.id, resolved);
            }
        });
    }

    /**
     * Creates a template. Requires `DIRECT_EMAIL_TEMPLATE_WRITE`.
     *
     * @param actor - The admin actor (recorded as creator)
     * @param input - Name, subject and TipTap body
     * @param ctx - Optional service context
     * @returns The created template
     */
    public async create(
        actor: Actor,
        input: z.input<typeof CreateDirectEmailTemplateSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<DirectEmailTemplate>> {
        return this.runWithLoggingAndValidation({
            methodName: 'create',
            input: { actor, ...input },
            schema: CreateDirectEmailTemplateSchema,
            ctx,
            execute: async (validated, _actor, resolved) => {
                checkCanWriteDirectEmailTemplate(actor);
                return this.model.create(
                    {
                        name: validated.name,
                        subject: validated.subject,
                        bodyJson: validated.bodyJson,
                        createdBy: actor.id
                    },
                    resolved.tx
                );
            }
        });
    }

    /**
     * Edits a live template. Requires `DIRECT_EMAIL_TEMPLATE_WRITE`. Messages already
     * sent keep their own copy of the body: nothing here touches them.
     *
     * @param actor - The admin actor (recorded as last editor)
     * @param input - The template id and the fields to change
     * @param ctx - Optional service context
     * @returns The updated template
     */
    public async update(
        actor: Actor,
        input: z.input<typeof UpdateInputSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<DirectEmailTemplate>> {
        return this.runWithLoggingAndValidation({
            methodName: 'update',
            input: { actor, ...input },
            schema: UpdateInputSchema,
            ctx,
            execute: async (validated, _actor, resolved) => {
                checkCanWriteDirectEmailTemplate(actor);
                await this.requireLive(validated.id, resolved);
                const updated = await this.model.update(
                    { id: validated.id },
                    { ...validated.data, updatedBy: actor.id },
                    resolved.tx
                );
                if (!updated) return this.requireLive(validated.id, resolved);
                return updated;
            }
        });
    }

    /**
     * Soft-deletes a live template. Requires `DIRECT_EMAIL_TEMPLATE_WRITE`.
     *
     * @param actor - The admin actor
     * @param input - The template id
     * @param ctx - Optional service context
     * @returns `{ id }` of the deleted template
     */
    public async softDelete(
        actor: Actor,
        input: z.input<typeof IdInputSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ id: string }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'softDelete',
            input: { actor, ...input },
            schema: IdInputSchema,
            ctx,
            execute: async (validated, _actor, resolved) => {
                checkCanWriteDirectEmailTemplate(actor);
                await this.requireLive(validated.id, resolved);
                await this.model.softDelete({ id: validated.id }, actor.id, resolved.tx);
                return { id: validated.id };
            }
        });
    }
}
