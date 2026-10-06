/**
 * DELETE /api/v1/protected/gastronomies/:id/menu-file
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former plan gate or limit is removed.
 */

import { PermissionEnum, SuccessSchema } from '@repo/schemas';
import { GastronomyService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createProtectedRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

export const protectedDeleteGastronomyMenuFileRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}/menu-file',
    summary: 'Remove the uploaded menu photo or PDF',
    description:
        'Clears the listing’s uploaded menu file and deletes the stored asset. Owner-only, and requires the manage_gastronomy_menu entitlement granted by the professional gastronomy plan and above. The structured menu and the external link are untouched.',
    tags: ['Gastronomy', 'Gastronomy Menu'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: SuccessSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed MANAGE_GASTRONOMY_MENU entitlement gate.
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const gastronomyId = params.id as string;

        const listing = await gastronomyService.getById(actor, gastronomyId);
        const hasEditAll = actor.permissions?.includes(PermissionEnum.COMMERCE_EDIT_ALL);

        // 404, not 403 — a 403 would confirm the id exists (error contract).
        if (
            listing.error ||
            !listing.data ||
            (!hasEditAll && listing.data.ownerId !== actor.id) ||
            (!hasEditAll && !actor.permissions?.includes(PermissionEnum.COMMERCE_EDIT_OWN))
        ) {
            return createErrorResponse(
                { code: 'NOT_FOUND', message: 'Gastronomy listing not found' },
                ctx,
                404
            );
        }

        const publicId = listing.data.menuFilePublicId;

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`.
        const model = (
            gastronomyService as unknown as {
                model: {
                    update: (
                        where: Record<string, unknown>,
                        data: Record<string, unknown>
                    ) => Promise<unknown>;
                };
            }
        ).model;

        await model.update(
            { id: gastronomyId },
            {
                menuFileUrl: null,
                menuFilePublicId: null,
                menuFileKind: null,
                updatedById: actor.id
            }
        );

        // Best-effort, AFTER the columns are cleared. Ordered this way on
        // purpose: if the asset deletion throws, the menu is already withdrawn
        // from the listing, which is what the owner asked for.
        if (publicId) {
            const provider = getMediaProvider();
            try {
                await provider?.delete({ publicId });
            } catch (error) {
                apiLogger.warn(
                    {
                        error: error instanceof Error ? error.message : String(error),
                        gastronomyId,
                        publicId
                    },
                    'Menu file cleared from listing but the stored asset could not be deleted'
                );
            }
        }

        return { success: true } as const;
    },
    options: {}
});
