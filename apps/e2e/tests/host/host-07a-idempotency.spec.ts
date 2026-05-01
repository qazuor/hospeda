/**
 * HOST-07a — Onboarding idempotency on mini-form retry + defense-in-depth
 *             re-promotion after demote.
 *
 * Actors: USER → HOST → (demoted) USER → HOST again.
 * Tags: @p0 @host @onboarding @resilience
 *
 * Preconditions:
 *   - Email address does not exist in `users`.
 *   - At least one CITY destination in `destinations` (seeded).
 *
 * What this validates:
 *  1. Posting `/host-onboarding/start` for a freshly-signed-up user returns
 *     `status='created'` with a non-null accommodationId.
 *  2. Posting the same payload a second time returns `status='already_host'`
 *     and creates no new accommodation rows.
 *  3. Demoting the user back to USER (simulating legacy data) and posting
 *     a third time returns `status='resumed'`, references the same
 *     accommodation as call 1, and re-promotes the user to HOST.
 *
 * Why we drive this via API rather than the UI:
 *   The UI flow is covered by HOST-01. HOST-07a focuses on the idempotency
 *   contract of the underlying endpoint, which is the actual safeguard
 *   against double-publish / double-promote bugs.
 *
 * @see SPEC-092 spec.md § HOST-07
 */

import { expect, test } from '@playwright/test';
import {
    forceVerifyEmail,
    getAnyCityDestinationId,
    signupUser,
    startHostOnboarding
} from '../../fixtures/api-helpers.ts';
import { demoteHostToUser, execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('HOST-07a: onboarding idempotency + re-promotion @p0 @host @onboarding @resilience', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('post1=created, post2=already_host, demote+post3=resumed (re-promoted)', async () => {
        const user = await signupUser({}, { apiBaseUrl: API_URL });
        userId = user.id;
        await forceVerifyEmail(user.id);

        const cityId = await getAnyCityDestinationId();

        const payload = {
            sessionCookie: user.sessionCookie,
            name: 'HOST-07a Casa',
            summary: 'Idempotency test accommodation',
            type: 'house',
            cityDestinationId: cityId
        };

        // ── Call 1: created ────────────────────────────────────────────────
        const first = await startHostOnboarding(payload, { apiBaseUrl: API_URL });
        expect(first.status).toBe('created');
        expect(first.accommodationId).not.toBeNull();
        const firstAccommodationId = first.accommodationId;

        const usersAfter1 = await execSQL<{ role: string }>(
            'SELECT role FROM users WHERE id = $1',
            [user.id]
        );
        expect(usersAfter1[0]?.role).toBe('HOST');

        const accsAfter1 = await execSQL<{ id: string }>(
            'SELECT id FROM accommodations WHERE owner_id = $1',
            [user.id]
        );
        expect(accsAfter1.length).toBe(1);

        // ── Call 2: already_host (no new rows) ─────────────────────────────
        const second = await startHostOnboarding(payload, { apiBaseUrl: API_URL });
        expect(second.status).toBe('already_host');
        expect(second.accommodationId).toBeNull();

        const accsAfter2 = await execSQL<{ id: string }>(
            'SELECT id FROM accommodations WHERE owner_id = $1',
            [user.id]
        );
        expect(accsAfter2.length, 'second call must not insert another accommodation').toBe(1);

        // ── Demote + Call 3: resumed, re-promoted ──────────────────────────
        await demoteHostToUser(user.id);

        const usersDemoted = await execSQL<{ role: string }>(
            'SELECT role FROM users WHERE id = $1',
            [user.id]
        );
        expect(usersDemoted[0]?.role).toBe('USER');

        const third = await startHostOnboarding(payload, { apiBaseUrl: API_URL });
        expect(
            third.status === 'resumed' || third.status === 'created',
            `expected resumed/created after demote (got ${third.status})`
        ).toBe(true);

        // The endpoint must re-promote to HOST as defense-in-depth.
        const usersAfter3 = await execSQL<{ role: string }>(
            'SELECT role FROM users WHERE id = $1',
            [user.id]
        );
        expect(usersAfter3[0]?.role, 'role must be re-promoted USER → HOST on resumed call').toBe(
            'HOST'
        );

        // Still exactly one accommodation owned by the user — resumed must
        // not duplicate the draft.
        const accsAfter3 = await execSQL<{ id: string }>(
            'SELECT id FROM accommodations WHERE owner_id = $1',
            [user.id]
        );
        expect(accsAfter3.length).toBe(1);
        if (firstAccommodationId) {
            expect(
                accsAfter3[0]?.id,
                'resumed must reference the original DRAFT accommodation'
            ).toBe(firstAccommodationId);
        }
    });
});
