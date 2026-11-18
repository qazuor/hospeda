/**
 * GET /api/v1/protected/venues/:id/whatsapp
 *
 * The number behind the WhatsApp button of a venue whose owner chose
 * "solo usuarios logueados" (HOS-2256 section 7.8). The public page is
 * session-blind and edge-cached, so in that mode the number is NEVER in the
 * HTML: a client island asks here, with the visitor's session, and only then
 * builds the `wa.me` link.
 *
 * Answers (error contract order): 401 for a guest (the protected tier rejects
 * it before the handler), 400 for a malformed id, 404 for an unknown,
 * unpublished or deleted venue. For a published venue it answers 200 with
 * `{ number }`; `number` is `null` when the owner stores none or never chose a
 * visibility, so no signed-in visitor can read a number the owner did not opt
 * to share. Per-viewer: never cached.
 *
 * @module routes/venue/protected/getWhatsapp
 */
import { getVenueWhatsappForViewer, VenueService } from '@repo/service-core';
// Same module instance `utils/response-helpers` compares against (see getMenu.ts).
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });

/** Response of the endpoint. */
const VenueWhatsappResponseSchema = z.object({
    number: z.string().nullable()
});

/** Reads the number. Exported standalone so the route test can call it directly. */
export async function handleGetVenueWhatsapp(_ctx: Context, params: Record<string, unknown>) {
    // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`, the
    // same accessor the menu and events routes use.
    const model = (
        venueService as unknown as { model: Parameters<typeof getVenueWhatsappForViewer>[0] }
    ).model;
    const result = await getVenueWhatsappForViewer(model, { venueId: params.id as string });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return result.data;
}

export const protectedGetVenueWhatsappRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/whatsapp',
    summary: 'Get the WhatsApp number of a venue (signed-in visitors)',
    description:
        "Returns the venue's WhatsApp number to a signed-in visitor when the owner chose to share it with signed-in users. Never exposes the number otherwise. Per-viewer, uncached.",
    tags: ['Venue'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenueWhatsappResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetVenueWhatsapp(ctx, params),
    options: {
        // A contact reveal for any signed-in account, so it is bounded per
        // client: 20 per minute is far above a person opening venue pages and
        // far below a script walking venue ids (same order as the QR sheet).
        customRateLimit: { requests: 20, windowMs: 60_000 }
    }
});
