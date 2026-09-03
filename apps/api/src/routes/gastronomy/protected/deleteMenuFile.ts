/**
 * DELETE /api/v1/protected/gastronomies/:id/menu-file
 *
 * Removes the uploaded photo/PDF of the venue's menu (HOS-895).
 *
 * Deletes the ASSET as well as the columns, which is the point: forgetting the
 * URL and leaving the file in Cloudinary is exactly the orphan HOS-372 built
 * `gastronomy_media` to stop, and `menu_file_public_id` exists so this route
 * has the handle it needs to do it properly.
 *
 * The provider deletion is best-effort and does NOT fail the request. If
 * Cloudinary is unreachable we still clear the columns: the owner asked for the
 * menu to stop being shown, and refusing them that because a third party is
 * down would be the wrong way round. The cost of the two failing together is a
 * single orphaned asset, which is recoverable; leaving a withdrawn menu on the
 * public page is not.
 *
 * Gated on `MANAGE_GASTRONOMY_MENU`, same as the upload (HOS-895 PR2) — see
 * `uploadMenuFile.ts` for why. Deleting is refused the same as replacing: a
 * `-basico` owner cannot clear an attachment that predates the gate any more
 * than they can upload a new one. That is intentional, not an oversight — the
 * withdraw path they DO have is downgrading to `menuUrl` only being what the
 * public page already renders for them (it stops showing the file the moment
 * `resolveOwnerGrantsGastronomyMenuManagement` returns `false`, regardless of
 * whether the row is deleted).
 *
 * @module routes/gastronomy/protected/deleteMenuFile
 */
import { EntitlementKey } from '@repo/billing';
import { PermissionEnum, SuccessSchema } from '@repo/schemas';
import { GastronomyService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { commerceVerticalEntitlementMiddleware } from '../../../middlewares/commerce-entitlement';
import { requireEntitlement } from '../../../middlewares/entitlement';
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
    options: {
        middlewares: [
            // Loader before checker (HOS-1074) — see uploadMenuFile.ts.
            commerceVerticalEntitlementMiddleware('gastronomy'),
            requireEntitlement(EntitlementKey.MANAGE_GASTRONOMY_MENU)
        ]
    }
});
