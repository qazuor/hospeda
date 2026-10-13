import type { Page } from '@playwright/test';
import { execSQL } from './db-helpers.ts';

/**
 * Fixtures of the listing notices of V8a (HOS-1492, V8a.1b): helpers that take
 * one of the spec's OWN listings to the state a `V/19` §4 row talks about,
 * without touching the global plan catalog.
 *
 * Two kinds of helper, on purpose:
 *
 * - The ones that drive a REAL route (`moderateListing` for PB10/PB11/fix
 *   requests, `purgeOwnListing` for PB12): the transition, its event and its
 *   side effects (closed alerts, queued mails) are the product's own.
 * - The ones that SEED a state no route reaches at the cut: a `PURGED` by
 *   inactivity (PB9 is V9b's, H8), an archive with its announced deletion date,
 *   a surplus unpublish, an extended trial. They write the listing status AND
 *   the `listing.status_changed` event the notices read, exactly as
 *   `listingPublicationModel.insertStatusChangedEvent` shapes it.
 *
 * Every row written here hangs off a user the spec created, and
 * {@link cleanupListingNoticeRows} removes the rows `cleanupTestUsers` does not
 * know about (alerts, fix requests, outbox).
 */

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';

/** A publication status as the listing tables store it. */
export type PublicationStatus =
    | 'DRAFT'
    | 'PUBLISHED'
    | 'UNPUBLISHED_BY_BILLING'
    | 'ARCHIVED'
    | 'MODERATED'
    | 'PURGED';

/** One administrative moderation gesture (`ListingModerationActionSchema`). */
export type ModerationAction =
    | { readonly action: 'REQUEST_FIX'; readonly reason: string; readonly suggestedDate?: string }
    | { readonly action: 'TAKE_DOWN'; readonly reason: string }
    | { readonly action: 'LIFT'; readonly reason: string; readonly keepFixRequest: boolean };

/**
 * Attaches a session cookie (`name=value; name=value`) to the page's context
 * for `localhost`, as the publish-card specs do.
 *
 * @param params.page - The Playwright page.
 * @param params.sessionCookie - The cookie header returned by `createUser`.
 */
export async function attachSession({
    page,
    sessionCookie
}: {
    readonly page: Page;
    readonly sessionCookie: string;
}): Promise<void> {
    const cookies = sessionCookie.split('; ').flatMap((cookie) => {
        const [name, ...valueParts] = cookie.split('=');
        return name ? [{ name, value: valueParts.join('='), domain: 'localhost', path: '/' }] : [];
    });
    await page.context().addCookies(cookies);
}

/**
 * Gives a listing a unique name, so a card can be found by it on a page that
 * lists several listings of the same owner.
 *
 * @param params.listingId - The accommodation id.
 * @param params.name - The new name.
 */
export async function renameListing({
    listingId,
    name
}: {
    readonly listingId: string;
    readonly name: string;
}): Promise<void> {
    await execSQL('UPDATE accommodations SET name = $2 WHERE id = $1', [listingId, name]);
}

/**
 * Re-reads a listing's publication status.
 *
 * @param params.listingId - The accommodation id.
 * @returns The status, or `undefined` when the row is gone.
 */
export async function readPublicationStatus({
    listingId
}: {
    readonly listingId: string;
}): Promise<string | undefined> {
    const rows = await execSQL<{ publication_status: string }>(
        'SELECT publication_status FROM accommodations WHERE id = $1',
        [listingId]
    );
    return rows[0]?.publication_status;
}

/**
 * Seeds a transition: sets the listing's status and appends the
 * `listing.status_changed` event the notices read (same `changes` shape as
 * `insertStatusChangedEvent`). `owner`/`admin` actors need an id
 * (`domain_event_person_actor_check`); a `job` has none.
 *
 * @param params.listingId - The accommodation id.
 * @param params.from - The status it leaves.
 * @param params.to - The status it enters.
 * @param params.actorType - Who did it.
 * @param params.actorId - The person, when `owner` or `admin`.
 * @param params.archiveOrigin - The archive origin of a `PB4`/`PB5` event.
 * @param params.deletionAnnouncedAt - The announced deletion date of an archive.
 */
export async function seedStatusTransition({
    listingId,
    from,
    to,
    actorType,
    actorId = null,
    archiveOrigin = null,
    deletionAnnouncedAt = null
}: {
    readonly listingId: string;
    readonly from: PublicationStatus;
    readonly to: PublicationStatus;
    readonly actorType: 'owner' | 'admin' | 'job';
    readonly actorId?: string | null;
    readonly archiveOrigin?: PublicationStatus | null;
    readonly deletionAnnouncedAt?: Date | null;
}): Promise<void> {
    const changes: { field: string; old?: unknown; new: unknown }[] = [
        { field: 'publicationStatus', old: from, new: to },
        ...(archiveOrigin ? [{ field: 'archiveOrigin', new: archiveOrigin }] : []),
        ...(deletionAnnouncedAt
            ? [{ field: 'deletionAnnouncedAt', old: null, new: deletionAnnouncedAt.toISOString() }]
            : [])
    ];
    await execSQL(
        `UPDATE accommodations
            SET publication_status = $2::publication_status_enum,
                deletion_announced_at = COALESCE($3::timestamptz, deletion_announced_at)
          WHERE id = $1`,
        [listingId, to, deletionAnnouncedAt]
    );
    await execSQL(
        `INSERT INTO domain_event
             (event_type, entity_type, entity_id, actor_id, actor_type, changes, correlation_id)
         VALUES ('listing.status_changed', 'accommodation', $1, $2, $3, $4::jsonb, gen_random_uuid())`,
        [listingId, actorId, actorType, JSON.stringify(changes)]
    );
}

/**
 * Row 20 (H8): a listing `PURGED` by inactivity. PB9 is V9b's, so nothing
 * produces it at the cut; it is seeded as PB9 will write it: `ARCHIVED →
 * PURGED` by the `job` actor.
 *
 * @param params.listingId - The accommodation id.
 */
export async function seedPurgedByInactivity({
    listingId
}: {
    readonly listingId: string;
}): Promise<void> {
    await seedStatusTransition({ listingId, from: 'DRAFT', to: 'ARCHIVED', actorType: 'job' });
    await seedStatusTransition({ listingId, from: 'ARCHIVED', to: 'PURGED', actorType: 'job' });
}

/**
 * Row 18: a listing archived from `origin` (PB4 from `PUBLISHED` returns on its
 * own; PB5 from `DRAFT` does not), with its announced deletion date.
 *
 * @param params.listingId - The accommodation id.
 * @param params.origin - The status it was archived from.
 * @param params.ownerId - The owner who archived it (PB5) — `null` for PB4's job.
 * @param params.deletionAnnouncedAt - The announced deletion date.
 */
export async function seedArchived({
    listingId,
    origin,
    ownerId,
    deletionAnnouncedAt
}: {
    readonly listingId: string;
    readonly origin: 'PUBLISHED' | 'DRAFT';
    readonly ownerId: string | null;
    readonly deletionAnnouncedAt: Date;
}): Promise<void> {
    await seedStatusTransition({
        listingId,
        from: origin,
        to: 'ARCHIVED',
        actorType: ownerId === null ? 'job' : 'owner',
        actorId: ownerId,
        archiveOrigin: origin,
        deletionAnnouncedAt
    });
}

/**
 * Rows 8 and 9: a listing a covered owner had published, lowered by the quota
 * to `UNPUBLISHED_BY_BILLING` (no `inactiveSince`, like `coverage-recalculation`).
 *
 * @param params.listingId - The accommodation id.
 */
export async function seedSurplusUnpublish({
    listingId
}: {
    readonly listingId: string;
}): Promise<void> {
    await seedStatusTransition({
        listingId,
        from: 'PUBLISHED',
        to: 'UNPUBLISHED_BY_BILLING',
        actorType: 'job'
    });
}

/** Throws with the response body when a route did not answer 2xx. */
async function assertOk({
    response,
    what
}: {
    readonly response: Response;
    readonly what: string;
}): Promise<void> {
    if (!response.ok) {
        throw new Error(`${what} failed with HTTP ${response.status}: ${await response.text()}`);
    }
}

/**
 * Runs an administrative moderation gesture through the REAL admin route
 * (`POST /api/v1/admin/accommodations/{id}/moderate`, `LISTING_MODERATE`).
 *
 * @param params.adminCookie - A SUPER_ADMIN session cookie.
 * @param params.listingId - The accommodation id.
 * @param params.body - The gesture.
 */
export async function moderateListing({
    adminCookie,
    listingId,
    body
}: {
    readonly adminCookie: string;
    readonly listingId: string;
    readonly body: ModerationAction;
}): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/admin/accommodations/${listingId}/moderate`, {
        method: 'POST',
        headers: { cookie: adminCookie, 'content-type': 'application/json' },
        body: JSON.stringify(body)
    });
    await assertOk({ response, what: `moderate ${body.action}` });
}

/**
 * The owner deletes their own listing through the REAL PB12 route
 * (`POST /api/v1/protected/accommodations/{id}/purge`).
 *
 * @param params.ownerCookie - The owner's session cookie.
 * @param params.listingId - The accommodation id.
 */
export async function purgeOwnListing({
    ownerCookie,
    listingId
}: {
    readonly ownerCookie: string;
    readonly listingId: string;
}): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/protected/accommodations/${listingId}/purge`, {
        method: 'POST',
        headers: { cookie: ownerCookie }
    });
    await assertOk({ response, what: 'owner purge' });
}

/**
 * Row 21: the owner's accommodation trial is spent. `ck_trial_clock_order`
 * requires `ends_at >= started_at`, so the clock is moved whole.
 *
 * @param params.ownerId - The owner.
 */
export async function expireAccommodationTrial({
    ownerId
}: {
    readonly ownerId: string;
}): Promise<void> {
    await execSQL(
        `UPDATE trial
            SET status = 'TRIAL_EXPIRED',
                started_at = NOW() - INTERVAL '31 days',
                ends_at = NOW() - INTERVAL '1 day'
          WHERE user_id = $1 AND vertical = 'accommodation'`,
        [ownerId]
    );
}

/**
 * Row 4: support extended the owner's running accommodation trial by `days`
 * (action 11 writes the longer clock and a `trial.extended` event).
 *
 * @param params.ownerId - The owner.
 * @param params.days - Days given by support.
 * @returns The total days of the trial after the extension.
 */
export async function extendAccommodationTrialBySupport({
    ownerId,
    days
}: {
    readonly ownerId: string;
    readonly days: number;
}): Promise<{ readonly trialId: string; readonly totalDays: number }> {
    const rows = await execSQL<{ id: string; total_days: number }>(
        `UPDATE trial
            SET ends_at = ends_at + make_interval(days => $2::int)
          WHERE user_id = $1 AND vertical = 'accommodation'
          RETURNING id,
                    ROUND(EXTRACT(EPOCH FROM (ends_at - started_at)) / 86400)::int AS total_days`,
        [ownerId, days]
    );
    const row = rows[0];
    if (!row) throw new Error('extendAccommodationTrialBySupport: the owner has no trial');
    await execSQL(
        `INSERT INTO domain_event
             (event_type, entity_type, entity_id, actor_id, actor_type, changes, correlation_id)
         VALUES ('trial.extended', 'trial', $1, gen_random_uuid(), 'admin', $2::jsonb, gen_random_uuid())`,
        [row.id, JSON.stringify([{ field: 'days', old: null, new: days }])]
    );
    return { trialId: row.id, totalDays: Number(row.total_days) };
}

/**
 * A tourist's active price alert on a listing.
 *
 * @param params.userId - The tourist.
 * @param params.listingId - The accommodation id.
 * @returns The alert id.
 */
export async function seedPriceAlert({
    userId,
    listingId
}: {
    readonly userId: string;
    readonly listingId: string;
}): Promise<{ readonly alertId: string }> {
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO tourist_price_alerts (user_id, accommodation_id, base_price_snapshot, is_active)
         VALUES ($1, $2, 1500000, true)
         RETURNING id`,
        [userId, listingId]
    );
    const alertId = rows[0]?.id;
    if (!alertId) throw new Error('seedPriceAlert: insert returned no id');
    return { alertId };
}

/**
 * An open conversation of a tourist about a listing, with one message from
 * each side (the owner is the listing's owner: there is no host column).
 *
 * @param params.guestId - The tourist.
 * @param params.ownerId - The listing's owner.
 * @param params.listingId - The accommodation id.
 * @param params.guestBody - The tourist's message.
 * @param params.ownerBody - The owner's answer.
 * @returns The conversation id.
 */
export async function seedConversation({
    guestId,
    ownerId,
    listingId,
    guestBody,
    ownerBody
}: {
    readonly guestId: string;
    readonly ownerId: string;
    readonly listingId: string;
    readonly guestBody: string;
    readonly ownerBody: string;
}): Promise<{ readonly conversationId: string }> {
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO conversations (user_id, accommodation_id, status,
                                    first_guest_message_at, first_owner_reply_at, last_activity_at)
         VALUES ($1, $2, 'OPEN', NOW() - INTERVAL '2 hours',
                 NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour')
         RETURNING id`,
        [guestId, listingId]
    );
    const conversationId = rows[0]?.id;
    if (!conversationId) throw new Error('seedConversation: insert returned no id');
    await execSQL(
        `INSERT INTO messages (conversation_id, sender_type, user_id, body, created_at)
         VALUES ($1, 'GUEST', $2, $3, NOW() - INTERVAL '2 hours'),
                ($1, 'OWNER', $4, $5, NOW() - INTERVAL '1 hour')`,
        [conversationId, guestId, guestBody, ownerId, ownerBody]
    );
    return { conversationId };
}

/**
 * Removes what `cleanupTestUsers` does not know about: the alerts, the fix
 * requests and the outbox rows of the spec's own users and listings. Never a
 * global count or a truncate. The `domain_event` rows stay: the table is
 * append-only by trigger, and they only name the spec's own listing and trial
 * ids.
 *
 * @param params.userIds - The spec's users.
 * @param params.listingIds - The spec's listings.
 */
export async function cleanupListingNoticeRows({
    userIds,
    listingIds
}: {
    readonly userIds: readonly string[];
    readonly listingIds: readonly string[];
}): Promise<void> {
    if (userIds.length === 0 && listingIds.length === 0) return;
    await execSQL('DELETE FROM tourist_price_alerts WHERE user_id = ANY($1::uuid[])', [userIds]);
    await execSQL('DELETE FROM email_outbox WHERE recipient_user_id = ANY($1::uuid[])', [userIds]);
    await execSQL('DELETE FROM fix_request WHERE entity_id = ANY($1::uuid[])', [listingIds]);
}
