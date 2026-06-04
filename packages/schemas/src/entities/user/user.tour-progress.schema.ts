import { z } from 'zod';

/**
 * Request body for `PATCH /api/v1/protected/users/me/tour-progress`.
 *
 * Marks one admin guided tour as seen at a specific config version for the
 * authenticated user. The server performs a server-side read-modify-write
 * merge — only `settings.onboarding.adminTours[tourId]` is overwritten;
 * all other settings keys (theme, language, notifications, newsletter,
 * `onboarding.whatsNew`) are preserved untouched.
 *
 * Idempotent: calling this endpoint again with the same `tourId` and
 * `version` is safe — the map entry is simply overwritten with the same value.
 *
 * @see {@link TourProgressBody} for the inferred TypeScript type.
 * @see SPEC-174 §6.2 — Dedicated endpoint contract.
 */
export const TourProgressBodySchema = z.object({
    /**
     * Catalog identifier of the tour being marked as seen.
     *
     * Must match a key from the admin tour config (e.g. `'host.welcome'`,
     * `'editor.analisis'`). Bounded defensively to 100 characters — the same
     * cap used for What's New entry ids — to prevent unbounded JSONB growth
     * from a malformed or malicious client. Legitimate tour ids are all well
     * under this limit.
     */
    tourId: z.string().min(1).max(100),

    /**
     * Config version of the tour being acknowledged.
     *
     * Must match the `version` field from the tour's config entry (a
     * positive integer). The server stores this value as-is; subsequent
     * auto-trigger logic compares `config.version > seenVersion` to decide
     * whether to re-offer the tour after a content update.
     *
     * Non-negative integer (0 is accepted but unusual — v1 tours start at 1).
     * Floats are rejected.
     */
    version: z.number().int().nonnegative()
});

/** Inferred TypeScript type for {@link TourProgressBodySchema}. */
export type TourProgressBody = z.infer<typeof TourProgressBodySchema>;
