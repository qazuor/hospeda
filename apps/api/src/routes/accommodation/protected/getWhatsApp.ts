/**
 * GET /api/v1/protected/accommodations/:id/whatsapp.
 * Per-viewer response stays uncached; legacy paid contact data is hidden
 * during the billing transition.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';

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
    if (accommodation?.lifecycleState !== 'ACTIVE' || accommodation.visibility !== 'PUBLIC') {
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

    // HOS-1352: transitional until V3 (HOS-1357), see PR — hide the former paid WhatsApp number.
    const payload = resolveWhatsAppPayload({
        rawNumber,
        entitled: false,
        canDirect: false
    });

    apiLogger.debug(
        `WhatsApp resolved for ${id}: hasNumber=${!!rawNumber}, entitled=${payload.entitled}, direct=${payload.direct}`
    );

    return c.json({ success: true, data: payload }, 200);
});

export { app as protectedGetWhatsAppRoute };
