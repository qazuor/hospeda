/**
 * GET /api/v1/protected/accommodations/:id/whatsapp
 *
 * Returns the accommodation's WhatsApp contact number, gated by the CALLER's
 * (viewer's) billing plan (HOS-19):
 * - `CAN_CONTACT_WHATSAPP_DISPLAY` (tourist-plus+ / owner-basico+) → the number.
 * - `CAN_CONTACT_WHATSAPP_DIRECT` (tourist-vip+ / owner-pro+) → `direct: true`,
 *   which authorizes the web to render a one-click `wa.me` deep link.
 *
 * Why a dedicated per-user endpoint (not the public detail payload): the public
 * `GET /public/accommodations/:id` response is shared-cached by the CDN (cache
 * key carries no auth), so a per-viewer field there would leak the first
 * viewer's plan result to everyone. This route is on the protected tier
 * (no-store / per-user), so the viewer gate is cache-safe. The number is NEVER
 * returned to an unentitled caller.
 *
 * Uses a manual Hono route (not createProtectedRoute) to avoid the ownership
 * middleware that other protected accommodation routes apply via app.use() —
 * mirrors the sibling `contact.ts` route. The number is a VIEWER capability, so
 * ownership is intentionally NOT required: any authenticated tourist on the
 * right plan may read it.
 */
import { EntitlementKey } from '@repo/billing';
import { ServiceErrorCode } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import { hasEntitlement } from '../../../middlewares/entitlement';
import { getActorFromContext, isGuestActor } from '../../../utils/actor';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Pure gating resolver for the WhatsApp payload (unit-testable; mirrors the
 * `resolvePriceAlertGateState` pattern). Fail-closed: the number is emitted ONLY
 * when the caller is entitled to display AND a non-empty number exists; the
 * `wa.me` `direct` link is authorized only when a number is emitted AND the
 * caller has the DIRECT entitlement.
 *
 * @param params.rawNumber - The owner-stored WhatsApp number (or null/blank).
 * @param params.entitled - Whether the caller has CAN_CONTACT_WHATSAPP_DISPLAY.
 * @param params.canDirect - Whether the caller has CAN_CONTACT_WHATSAPP_DIRECT.
 * @returns The viewer-safe payload `{ number, direct, entitled }`.
 */
export function resolveWhatsAppPayload({
    rawNumber,
    entitled,
    canDirect
}: {
    readonly rawNumber: string | null;
    readonly entitled: boolean;
    readonly canDirect: boolean;
}): { number: string | null; direct: boolean; entitled: boolean } {
    const number = entitled ? rawNumber : null;
    const direct = Boolean(number) && canDirect;
    return { number, direct, entitled };
}

const app = createRouter();

app.get('/:id/whatsapp', async (c) => {
    const actor = getActorFromContext(c);

    // Auth check — only authenticated users can ever reach a gated number.
    // Anonymous visitors get the upsell rendered by the web instead.
    if (isGuestActor(actor)) {
        return c.json(
            {
                success: false,
                error: { message: 'Authentication required', code: ServiceErrorCode.UNAUTHORIZED }
            },
            401
        );
    }

    const id = c.req.param('id');
    if (!id) {
        return c.json(
            {
                success: false,
                error: {
                    message: 'Accommodation ID is required',
                    code: ServiceErrorCode.VALIDATION_ERROR
                }
            },
            400
        );
    }

    const result = await accommodationService.getById(actor, id);

    if (result.error) {
        return c.json(
            {
                success: false,
                error: { message: result.error.message, code: result.error.code }
            },
            result.error.code === ServiceErrorCode.NOT_FOUND ? 404 : 400
        );
    }

    const accommodation = result.data;

    // Guard: only expose contact data for active public accommodations.
    if (
        !accommodation ||
        accommodation.lifecycleState !== 'ACTIVE' ||
        accommodation.visibility !== 'PUBLIC'
    ) {
        return c.json(
            {
                success: false,
                error: { message: 'Accommodation not found', code: ServiceErrorCode.NOT_FOUND }
            },
            404
        );
    }

    const contactInfo = accommodation.contactInfo as { whatsapp?: string | null } | null;
    const rawNumber =
        typeof contactInfo?.whatsapp === 'string' && contactInfo.whatsapp.trim().length > 0
            ? contactInfo.whatsapp.trim()
            : null;

    const payload = resolveWhatsAppPayload({
        rawNumber,
        entitled: hasEntitlement(c, EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY),
        canDirect: hasEntitlement(c, EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT)
    });

    apiLogger.debug(
        `WhatsApp resolved for ${id}: hasNumber=${!!rawNumber}, entitled=${payload.entitled}, direct=${payload.direct}`
    );

    return c.json({ success: true, data: payload }, 200);
});

export { app as protectedGetWhatsAppRoute };
