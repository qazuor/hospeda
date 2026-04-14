/**
 * GET /api/v1/protected/accommodations/:id/contact
 * Returns resolved contact info for an accommodation.
 * Auth required. Only exposes email/phone/website — never raw contactInfo.
 *
 * Uses manual Hono route (not createProtectedRoute) to avoid the ownership
 * middleware that other protected accommodation routes apply via app.use().
 */
import { accommodations, getDb } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { and, eq } from 'drizzle-orm';
import { getActorFromContext, isGuestActor } from '../../../utils/actor';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';
import { ResponseFactory } from '../../../utils/response-factory';

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
        return ResponseFactory.error(
            c,
            'Authentication required',
            401,
            ServiceErrorCode.UNAUTHORIZED
        );
    }

    const id = c.req.param('id');
    if (!id) {
        return ResponseFactory.error(
            c,
            'Accommodation ID is required',
            400,
            ServiceErrorCode.VALIDATION_ERROR
        );
    }

    const db = getDb();
    const rows = await db
        .select({
            contactInfo: accommodations.contactInfo
        })
        .from(accommodations)
        .where(
            and(
                eq(accommodations.id, id),
                eq(accommodations.lifecycleState, 'ACTIVE'),
                eq(accommodations.visibility, 'PUBLIC')
            )
        )
        .limit(1);

    if (rows.length === 0) {
        return ResponseFactory.error(c, 'Accommodation not found', 404, ServiceErrorCode.NOT_FOUND);
    }

    const raw = rows[0].contactInfo as Record<string, unknown> | null;
    if (!raw) {
        return ResponseFactory.success(c, {});
    }

    const email = resolveEmail(raw);
    const phone = resolvePhone(raw);
    const website = raw.website as string | undefined;

    const result: Record<string, string> = {};
    if (email) result.email = email;
    if (phone) result.phone = phone;
    if (website) result.website = website;

    apiLogger.debug('Contact info resolved', {
        accommodationId: id,
        hasEmail: !!email,
        hasPhone: !!phone,
        hasWebsite: !!website
    });

    return ResponseFactory.success(c, result);
});

export { app as protectedGetContactRoute };
