/**
 * Admin direct email template routes (HOS-2685), mounted at
 * `/api/v1/admin/direct-email-templates`. Reads need `DIRECT_EMAIL_VIEW`, writes need
 * `DIRECT_EMAIL_TEMPLATE_WRITE`. The responses carry the TipTap JSON so the CRM
 * (HOS-2686) can consume the same templates.
 *
 * @module routes/direct-email/admin/templates
 */

import {
    CreateDirectEmailTemplateSchema,
    DirectEmailTemplateAdminSearchSchema,
    DirectEmailTemplateSchema,
    PermissionEnum,
    UpdateDirectEmailTemplateSchema
} from '@repo/schemas';
import { getActorFromContext } from '../../../utils/actor';
import { getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory';
import { z } from '../../../utils/zod';
import { getDirectEmailTemplateService, unwrapDirectEmailResult } from '../_singletons';

const TemplateIdParam = { id: z.string().uuid('Template ID must be a valid UUID') };

/** GET /: paginated live templates. */
export const adminListDirectEmailTemplatesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List direct email templates (admin)',
    description: 'Paginated live templates, most recently edited first.',
    tags: ['Direct emails'],
    requiredPermissions: [PermissionEnum.DIRECT_EMAIL_VIEW],
    requestQuery: DirectEmailTemplateAdminSearchSchema.shape,
    responseSchema: DirectEmailTemplateSchema,
    handler: async (ctx, _params, _body, query) => {
        const { page, pageSize, search } = DirectEmailTemplateAdminSearchSchema.parse(query ?? {});
        const { items, total } = unwrapDirectEmailResult(
            await getDirectEmailTemplateService().list(getActorFromContext(ctx), {
                page,
                pageSize,
                ...(search ? { search } : {})
            })
        );
        return { items, pagination: getPaginationResponse(total, { page, pageSize }) };
    }
});

/** GET /{id}: one live template. */
export const adminGetDirectEmailTemplateRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get direct email template (admin)',
    description: 'Returns a live template with its TipTap body.',
    tags: ['Direct emails'],
    requiredPermissions: [PermissionEnum.DIRECT_EMAIL_VIEW],
    requestParams: TemplateIdParam,
    responseSchema: DirectEmailTemplateSchema,
    handler: async (ctx, params) =>
        unwrapDirectEmailResult(
            await getDirectEmailTemplateService().getById(getActorFromContext(ctx), {
                id: params.id as string
            })
        )
});

/** POST /: create a template. */
export const adminCreateDirectEmailTemplateRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create direct email template (admin)',
    description: 'Creates a template (name, subject, TipTap body).',
    tags: ['Direct emails'],
    requiredPermissions: [PermissionEnum.DIRECT_EMAIL_TEMPLATE_WRITE],
    requestBody: CreateDirectEmailTemplateSchema,
    responseSchema: DirectEmailTemplateSchema,
    handler: async (ctx, _params, body) =>
        unwrapDirectEmailResult(
            await getDirectEmailTemplateService().create(
                getActorFromContext(ctx),
                CreateDirectEmailTemplateSchema.parse(body)
            )
        )
});

/** PATCH /{id}: edit a template. Mails already sent keep their own copy. */
export const adminUpdateDirectEmailTemplateRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Update direct email template (admin)',
    description: 'Partially updates a template. Messages already sent are not affected.',
    tags: ['Direct emails'],
    requiredPermissions: [PermissionEnum.DIRECT_EMAIL_TEMPLATE_WRITE],
    requestParams: TemplateIdParam,
    requestBody: UpdateDirectEmailTemplateSchema,
    responseSchema: DirectEmailTemplateSchema,
    handler: async (ctx, params, body) =>
        unwrapDirectEmailResult(
            await getDirectEmailTemplateService().update(getActorFromContext(ctx), {
                id: params.id as string,
                data: UpdateDirectEmailTemplateSchema.parse(body)
            })
        )
});

/** DELETE /{id}: soft-delete a template. */
export const adminDeleteDirectEmailTemplateRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete direct email template (admin)',
    description: 'Soft-deletes a template.',
    tags: ['Direct emails'],
    requiredPermissions: [PermissionEnum.DIRECT_EMAIL_TEMPLATE_WRITE],
    requestParams: TemplateIdParam,
    responseSchema: z.null(),
    handler: async (ctx, params) => {
        unwrapDirectEmailResult(
            await getDirectEmailTemplateService().softDelete(getActorFromContext(ctx), {
                id: params.id as string
            })
        );
        return null;
    }
});
