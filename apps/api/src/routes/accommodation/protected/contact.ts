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
        return c.json(
            {
                success: false,
                error: { message: 'Accommodation not found', code: ServiceErrorCode.NOT_FOUND }
            },
            404
        );
    }

    const row = rows[0];
    if (!row) {
        return c.json(
            {
                success: false,
                error: { message: 'Accommodation not found', code: ServiceErrorCode.NOT_FOUND }
            },
            404
        );
    }
    const raw = row.contactInfo as Record<string, unknown> | null;
    if (!raw) {
        return c.json({ success: true, data: {} }, 200);
    }

    const email = resolveEmail(raw);
    const phone = resolvePhone(raw);
    const website = raw.website as string | undefined;

    const result: Record<string, string> = {};
    if (email) result.email = email;
    if (phone) result.phone = phone;
    if (website) result.website = website;

    apiLogger.debug(
        `Contact info resolved for ${id}: email=${!!email}, phone=${!!phone}, website=${!!website}`
    );

    return c.json({ success: true, data: result }, 200);
});

export { app as protectedGetContactRoute };
