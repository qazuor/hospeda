/**
 * HOST-07a — Onboarding create-always on mini-form retry + defense-in-depth
 *             re-promotion after demote (BETA-197: drafts now accumulate).
 *
 * Actors: USER → HOST → (demoted) USER → HOST again.
 * Tags: @p0 @host @onboarding @resilience
 *
 * Preconditions:
 *   - Email address does not exist in `users`.
 *   - At least one CITY destination in `destinations` (seeded).
 *
 * What this validates (updated for BETA-197 — the pre-existing "at most one
 * active DRAFT per user" auto-resume invariant was intentionally removed;
 * each `/start` now CREATES a fresh draft and drafts count against
 * `max_accommodations`):
 *  1. Posting `/host-onboarding/start` for a freshly-signed-up user returns
 *     `status='created'` with a non-null accommodationId.
 *  2. Posting the same payload a second time (the owner still has quota via
 *     the pre-seeded owner-premium plan) returns `status='created'` and
 *     inserts a SECOND draft — no auto-resume.
 *  3. Demoting the user back to USER (simulating legacy data) and posting a
 *     third time returns `status='created'`, inserts a THIRD draft, and
 *     re-promotes the user to HOST (defense-in-depth).
 *
 * Why we drive this via API rather than the UI:
 *   The UI flow is covered by HOST-01. HOST-07a focuses on the create-always
 *   + role-repromotion contract of the underlying endpoint (the safeguard
 *   against double-promote bugs). The pre-BETA-197 idempotency / single-draft
 *   contract this file used to assert is gone by design; the new UX gate that
 *   prevents accidental duplicate drafts lives in the web precheck panel.
 *
 * @see SPEC-092 spec.md § HOST-07
 */

import { expect, test } from '@playwright/test';
import {
    createSubscription,
    forceVerifyEmail,
    getAnyCityDestinationId,
    signupUser,
    startHostOnboarding
} from '../../fixtures/api-helpers.ts';
import { demoteHostToUser, execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('HOST-07a: onboarding create-always + re-promotion @p0 @host @onboarding @resilience', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('post1=created, post2=created (2nd draft), demote+post3=created (3rd draft, re-promoted)', async () => {
        const user = await signupUser({}, { apiBaseUrl: API_URL });
        userId = user.id;
        await forceVerifyEmail(user.id);

        const cityId = await getAnyCityDestinationId();

        const payload = {
            sessionCookie: user.sessionCookie,
            name: 'HOST-07a Casa',
            summary: 'Create-always test accommodation',
            type: 'house',
            cityDestinationId: cityId
        };

        // ── Pre-seed premium subscription BEFORE Call 1 ───────────────────
        // The default owner-basico plan has max_accommodations=1. Since BETA-197
        // each /start CREATES a draft and drafts count against the limit, so with
        // owner-basico Call 2 would be blocked by enforceAccommodationLimit
        // (LIMIT_REACHED). Pre-seeding owner-premium (max_accommodations=10) before
        // Call 1 populates the entitlement cache with premium limits on the first
        // API call, so Calls 2 and 3 pass the limit check and each create a draft.
        // Note: createSubscription uses SELECT-or-INSERT for the billing_customers
        // row, so it works correctly even before the onboarding endpoint creates any
        // billing state.
        const premiumPlanRows = await execSQL<{ id: string }>(
            `SELECT id FROM billing_plans
             WHERE name = 'owner-premium' AND active = true
             LIMIT 1`
        );
        if (premiumPlanRows[0]?.id) {
            await createSubscription({
                userId: user.id,
                planId: premiumPlanRows[0].id,
                status: 'active'
            });
        }

        // ── Call 1: created ────────────────────────────────────────────────
        // In local dev (NODE_ENV !== 'test'), the rate limiter may fire 429 after
        // many previous test runs within the same 15-minute window. If Call 1 is
        // rate-limited, we cannot set up the preconditions for the create-always
        // checks. Mark the whole test as fixme in that case — the contract is
        // validated in CI where the API starts fresh with NODE_ENV=test.
        let first: Awaited<ReturnType<typeof startHostOnboarding>>;
        try {
            first = await startHostOnboarding(payload, { apiBaseUrl: API_URL });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('429') || msg.includes('RATE_LIMIT_EXCEEDED')) {
                test.fixme(
                    true,
                    'HOST-07a skipped: API rate limiter fired on Call 1 (local dev window exhausted). ' +
                        'Run tests after the 15-minute window resets or with NODE_ENV=test.'
                );
                return;
            }
            throw err;
        }
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

        // ── Call 2: created again (a SECOND draft) ─────────────────────────
        // Since BETA-197 the endpoint no longer auto-resumes: the user is HOST
        // with an active DRAFT and still has quota (owner-premium), so a fresh
        // draft is created.
        // Note: If the API is running in a non-test mode (NODE_ENV !== 'test'), the rate
        // limiter may fire 429 on rapid sequential calls. We handle this gracefully by
        // annotating the test rather than hard-failing the run. The DB invariant is
        // still validated (accounting for whether the create actually happened).
        let secondCallRateLimited = false;
        let second: { status: string; accommodationId: string | null } | null = null;
        try {
            second = await startHostOnboarding(payload, { apiBaseUrl: API_URL });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('429') || msg.includes('RATE_LIMIT_EXCEEDED')) {
                secondCallRateLimited = true;
                test.info().annotations.push({
                    type: 'warning',
                    description:
                        'HOST-07a Call 2 rate-limited (429). API running in non-test mode — ' +
                        'create-always API contract cannot be verified locally. DB invariant still checked.'
                });
            } else {
                throw err; // Re-throw unexpected errors
            }
        }

        if (!secondCallRateLimited && second) {
            // No auto-resume: a fresh draft is created.
            expect(second.status).toBe('created');
            expect(second.accommodationId).not.toBeNull();
            expect(second.accommodationId).not.toBe(firstAccommodationId);
        }

        // A successful Call 2 inserts a second draft; a rate-limited one does not.
        const expectedAfter2 = secondCallRateLimited ? 1 : 2;
        const accsAfter2 = await execSQL<{ id: string }>(
            'SELECT id FROM accommodations WHERE owner_id = $1',
            [user.id]
        );
        expect(
            accsAfter2.length,
            'second call creates a second draft (drafts count against the limit)'
        ).toBe(expectedAfter2);

        // ── Demote + Call 3: created, re-promoted ──────────────────────────
        await demoteHostToUser(user.id);

        const usersDemoted = await execSQL<{ role: string }>(
            'SELECT role FROM users WHERE id = $1',
            [user.id]
        );
        expect(usersDemoted[0]?.role).toBe('USER');

        let thirdCallRateLimited = false;
        let third: { status: string; accommodationId: string | null } | null = null;
        try {
            third = await startHostOnboarding(payload, { apiBaseUrl: API_URL });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('429') || msg.includes('RATE_LIMIT_EXCEEDED')) {
                thirdCallRateLimited = true;
                test.info().annotations.push({
                    type: 'warning',
                    description:
                        'HOST-07a Call 3 rate-limited (429). Re-promotion contract cannot be ' +
                        'verified. DB invariant still checked.'
                });
            } else {
                throw err;
            }
        }

        if (!thirdCallRateLimited && third) {
            expect(third.status, `expected created after demote (got ${third.status})`).toBe(
                'created'
            );
        }

        // The endpoint must re-promote to HOST as defense-in-depth.
        // Only assertable if Call 3 actually reached the handler.
        if (!thirdCallRateLimited) {
            const usersAfter3 = await execSQL<{ role: string }>(
                'SELECT role FROM users WHERE id = $1',
                [user.id]
            );
            expect(
                usersAfter3[0]?.role,
                'role must be re-promoted USER → HOST on the create call'
            ).toBe('HOST');
        }

        // A successful Call 3 inserts a third draft on top of whatever existed.
        const expectedAfter3 = expectedAfter2 + (thirdCallRateLimited ? 0 : 1);
        const accsAfter3 = await execSQL<{ id: string }>(
            'SELECT id FROM accommodations WHERE owner_id = $1',
            [user.id]
        );
        expect(
            accsAfter3.length,
            'third call creates a third draft; existing drafts are never replaced'
        ).toBe(expectedAfter3);

        // Create-always must never delete or replace the original draft.
        if (firstAccommodationId) {
            expect(
                accsAfter3.map((a) => a.id),
                'the original draft from Call 1 must still exist'
            ).toContain(firstAccommodationId);
        }
    });
});
