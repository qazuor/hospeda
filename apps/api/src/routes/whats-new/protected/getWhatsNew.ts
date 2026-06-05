/**
 * GET /api/v1/protected/whats-new
 *
 * Returns the curated What's New entries applicable to the authenticated actor's
 * role, with server-side locale resolution and seen-state computation.
 *
 * Key behaviours (SPEC-175 §6.5):
 * - No `requiredPermissions` — any authenticated non-guest session is sufficient
 *   (D4: `roles` in entries is audience targeting, not an authorization gate).
 * - Lazy init: if `settings.onboarding.whatsNew` is absent, the server sets
 *   `baselineAt = now, seenIds = []` and persists via `initWhatsNewBaseline`.
 *   Failure is non-fatal — the handler continues with an empty fallback state.
 * - Role filter: only entries whose `roles` array includes the actor's role
 *   (or is absent/empty) are returned.
 * - Seen computation: an entry is seen if its id is in `seenIds` OR its
 *   `publishedAt <= baselineAt`.
 * - Locale resolution: uses `actor.settings.languageAdmin ?? 'es'`, falling
 *   back to `'es'` when the requested locale is missing from an entry.
 * - Sort: newest-first by `publishedAt`.
 *
 * @see SPEC-175 §6.5, §6.7, §10
 */
import type { WhatsNewGetResponse, WhatsNewItem } from '@repo/schemas';
import { WhatsNewGetResponseSchema } from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { whatsNewEntries } from '../../../data/whats-new/whats-new';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import {
    computeSeen,
    filterEntriesByRole,
    resolveEntryLocale
} from '../../../utils/whats-new/whats-new.helpers';

const userService = new UserService({ logger: apiLogger });

/**
 * Pure handler for the What's New GET route. Extracted for unit-testability
 * without requiring the full app to boot.
 *
 * @param ctx - Hono context (used to resolve the authenticated actor).
 * @param svc - UserService instance (injectable for tests).
 * @returns Role-filtered, locale-resolved, newest-first entry list + unseenCount.
 */
export const getWhatsNewHandler = async (
    ctx: Context,
    svc: typeof userService = userService
): Promise<WhatsNewGetResponse> => {
    const actor = getActorFromContext(ctx);

    // Read actor's user record to access settings.
    const userResult = await svc.getById(actor, actor.id);
    if (userResult.error) {
        throw new ServiceError(userResult.error.code, userResult.error.message);
    }

    const user = userResult.data;
    if (!user) {
        throw new ServiceError('NOT_FOUND' as never, 'User not found');
    }

    // Safely navigate settings.onboarding.whatsNew.
    const settings = (user.settings as Record<string, unknown>) ?? {};
    const onboarding = (settings.onboarding as Record<string, unknown>) ?? {};
    let whatsNewState = onboarding.whatsNew as
        | { baselineAt?: string; seenIds?: string[] }
        | undefined;

    // Lazy init: if the namespace is absent, initialize it now (§6.5 step 3, D8).
    if (whatsNewState === undefined) {
        const initResult = await svc.initWhatsNewBaseline(actor);
        if (initResult.error) {
            // Non-fatal per §15 — log and proceed with a safe empty fallback.
            apiLogger.warn(
                { actorId: actor.id, error: initResult.error.message },
                'whats-new baseline init failed, proceeding with fallback'
            );
            whatsNewState = { baselineAt: new Date().toISOString(), seenIds: [] };
        } else {
            // Re-read the freshly-initialized state from the service result data.
            // initWhatsNewBaseline returns { initialized: boolean } — we need to
            // re-read settings for the actual baselineAt. Use a fresh read only
            // when the init actually wrote (initialized === true); otherwise the
            // state was already present (race, shouldn't happen here).
            const freshResult = await svc.getById(actor, actor.id);
            if (freshResult.data) {
                const freshSettings = (freshResult.data.settings as Record<string, unknown>) ?? {};
                const freshOnboarding = (freshSettings.onboarding as Record<string, unknown>) ?? {};
                whatsNewState = (freshOnboarding.whatsNew as typeof whatsNewState) ?? {
                    baselineAt: new Date().toISOString(),
                    seenIds: []
                };
            } else {
                whatsNewState = { baselineAt: new Date().toISOString(), seenIds: [] };
            }
        }
    }

    const baselineAt = whatsNewState.baselineAt ?? new Date().toISOString();
    const seenIds: readonly string[] = whatsNewState.seenIds ?? [];

    // Resolve locale from actor settings (languageAdmin field).
    const actorSettings = (user.settings as Record<string, unknown>) ?? {};
    const locale = (actorSettings.languageAdmin as string | undefined) ?? 'es';

    // Filter by audience role (D4 — content routing, not authorization).
    const applicable = filterEntriesByRole({ entries: whatsNewEntries, role: actor.role });

    // Map to response items with seen computation and locale resolution.
    const items: WhatsNewItem[] = applicable.map((entry) => ({
        id: entry.id,
        publishedAt: entry.publishedAt,
        highlight: entry.highlight,
        title: resolveEntryLocale({ field: entry.title, locale }),
        body: resolveEntryLocale({ field: entry.body, locale }),
        ...(entry.image !== undefined ? { image: entry.image } : {}),
        seen: computeSeen({ entry, seenIds, baselineAt })
    }));

    // Sort newest-first by publishedAt.
    items.sort((a, b) => {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    const unseenCount = items.filter((i) => !i.seen).length;

    return WhatsNewGetResponseSchema.parse({ items, unseenCount });
};

/**
 * GET /api/v1/protected/whats-new
 *
 * Returns role-filtered, locale-resolved What's New entries with seen state.
 * No `requiredPermissions` — any authenticated non-guest session is sufficient.
 *
 * @see SPEC-175 §6.5
 */
export const protectedGetWhatsNewRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: "Get What's New entries",
    description:
        "Returns curated What's New / release-notes entries applicable to the actor's role, " +
        'with seen state and locale resolution. Lazy-initializes the baseline on first call.',
    tags: ["What's New"],
    responseSchema: WhatsNewGetResponseSchema,
    handler: (ctx: Context) => getWhatsNewHandler(ctx),
    options: {
        customRateLimit: { requests: 60, windowMs: 60000 }
    }
});
