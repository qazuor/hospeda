/**
 * GET /api/v1/protected/accommodations/:id/contact
 * Returns resolved contact info for an accommodation.
 * Auth required. Only exposes email/phone/website — never raw contactInfo.
 *
 * Uses manual Hono route (not createProtectedRoute) to avoid the ownership
 * middleware that other protected accommodation routes apply via app.use().
 */
import { ServiceErrorCode } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import { getActorFromContext, isGuestActor } from '../../../utils/actor';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Resolves the preferred email from a contactInfo JSONB object.
 */
function resolveEmail(contactInfo: Record<string, unknown>): string | undefined {
    const preferred = String(contactInfo.preferredEmail ?? '').toLowerCase();
    if (preferred === 'personal' && contactInfo.personalEmail) {
        return contactInfo.personalEmail as string;
    }
    if (preferred === 'work' && contactInfo.workEmail) {
        return contactInfo.workEmail as string;
    }
    return (
        (contactInfo.personalEmail as string | undefined) ??
        (contactInfo.workEmail as string | undefined) ??
        undefined
    );
}

/**
 * Resolves the preferred phone from a contactInfo JSONB object.
 */
function resolvePhone(contactInfo: Record<string, unknown>): string | undefined {
    const preferred = String(contactInfo.preferredPhone ?? '').toLowerCase();
    if (preferred === 'home' && contactInfo.homePhone) {
        return contactInfo.homePhone as string;
    }
    if (preferred === 'work' && contactInfo.workPhone) {
        return contactInfo.workPhone as string;
    }
    if (preferred === 'mobile' && contactInfo.mobilePhone) {
        return contactInfo.mobilePhone as string;
    }
    return (
        (contactInfo.mobilePhone as string | undefined) ??
        (contactInfo.homePhone as string | undefined) ??
        (contactInfo.workPhone as string | undefined) ??
        undefined
    );
}

const app = createRouter();

app.get('/:id/contact', async (c) => {
    const actor = getActorFromContext(c);

    // Auth check
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

    // Guard: only expose contact info for active public accommodations
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

    const raw = accommodation.contactInfo as Record<string, unknown> | null;
    if (!raw) {
        return c.json({ success: true, data: {} }, 200);
    }

    const email = resolveEmail(raw);
    const phone = resolvePhone(raw);
    const website = raw.website as string | undefined;

    const contact: Record<string, string> = {};
    if (email) contact.email = email;
    if (phone) contact.phone = phone;
    if (website) contact.website = website;

    apiLogger.debug(
        `Contact info resolved for ${id}: email=${!!email}, phone=${!!phone}, website=${!!website}`
    );

    return c.json({ success: true, data: contact }, 200);
});

export { app as protectedGetContactRoute };
