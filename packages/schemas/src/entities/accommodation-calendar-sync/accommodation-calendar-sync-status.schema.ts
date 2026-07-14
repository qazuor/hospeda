import type { z } from 'zod';
import { AccommodationCalendarSyncSchema } from './accommodation-calendar-sync.schema.js';

/**
 * Safe public/protected-facing projection of {@link AccommodationCalendarSyncSchema}
 * — this is what the `GET .../calendar/sync-status` route (Phase 2 API layer)
 * returns to callers.
 *
 * Deliberately EXCLUDES every token-related column (`accessTokenCiphertext`,
 * `accessTokenIv`, `accessTokenAuthTag`, `refreshTokenCiphertext`,
 * `refreshTokenIv`, `refreshTokenAuthTag`, `tokenScope`, `tokenExpiresAt`) as
 * well as internal audit fields (`id`, `accommodationId`, `syncToken`,
 * `createdById`, `createdAt`, `updatedAt`) — none of that is safe or useful to
 * expose to a client. Only the fields a host needs to see their connection's
 * health are kept: `provider`, `externalCalendarId`, `lastSyncAt`,
 * `lastSyncStatus`, `lastErrorMessage`, `isActive`.
 *
 * Built via `.pick()` off the full schema so the two never drift independently
 * — adding a new safe field here always means picking it from the single
 * source of truth, never redeclaring its validation.
 */
export const AccommodationCalendarSyncStatusSchema = AccommodationCalendarSyncSchema.pick({
    provider: true,
    externalCalendarId: true,
    lastSyncAt: true,
    lastSyncStatus: true,
    lastErrorMessage: true,
    isActive: true
});

/**
 * TypeScript type for the safe calendar-sync status projection, inferred
 * from {@link AccommodationCalendarSyncStatusSchema}.
 */
export type AccommodationCalendarSyncStatus = z.infer<typeof AccommodationCalendarSyncStatusSchema>;
