/**
 * HOST-07e — Cron demotes HOST → USER after the last DRAFT is archived.
 *
 * Actors: HOST owning only DRAFT accommodations + the
 *         `archive-abandoned-drafts` cron job.
 * Tags: @p0 @host @onboarding @cron
 *
 * **Status (HOS-1267)**: re-enabled. Both tests carried an unconditional
 * `test.fixme(true, ...)` from 2026-05-07 to 2026-09-21 — 4 months of a `@p0`
 * spec that never ran anywhere while still counting as present. The stated
 * blocker was that `POST /api/v1/cron/:name` had been removed in the VPS
 * migration; the fix the docblock itself prescribed —
 * `POST /api/v1/admin/cron/{jobName}` with an authenticated admin session —
 * has existed since SPEC-161 (`apps/api/src/routes/cron-admin/index.ts`,
 * `SYSTEM_MAINTENANCE_MODE`). It is now what the trigger calls.
 *
 * Note on `dryRun`: the query param is parsed with `z.coerce.boolean()`, for
 * which EVERY non-empty string — `'false'` included — coerces to `true`. The
 * trigger below therefore sends no `dryRun` at all rather than `dryRun=false`;
 * sending the latter would run the job in simulation and leave `demoted: 0`
 * with nothing archived, which reads exactly like a broken job.
 *
 * What this validates (two scenarios in one test):
 *
 *  Scenario A — single backdated DRAFT:
 *  1. Setup HOST + 1 DRAFT accommodation backdated > 30 days.
 *  2. Trigger the cron via the auth'd endpoint.
 *  3. Assert: accommodation flips to ARCHIVED, role demoted to USER.
 *
 *  Scenario B — two drafts (one fresh, one stale):
 *  1. Setup HOST + 1 fresh DRAFT + 1 backdated DRAFT.
 *  2. Trigger the cron.
 *  3. Assert: only the stale one is archived; the fresh one stays DRAFT;
 *     role remains HOST because the user still owns a non-archived row.
 *
 * @see SPEC-092 spec.md § HOST-07
 * @see apps/api/src/cron/jobs/archive-abandoned-drafts.job.ts
 */

import { expect, test } from '@playwright/test';
import { createAccommodation, createUser, forceVerifyEmail } from '../../fixtures/api-helpers.ts';
import {
    backdateAccommodation,
    execSQL,
    getDbPool,
    getUserRoles
} from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

/**
 * Triggers the `archive-abandoned-drafts` job through the admin cron endpoint.
 *
 * Deliberately passes NO `dryRun` query param — see the file header: the route
 * parses it with `z.coerce.boolean()`, so `dryRun=false` would be `true`.
 *
 * @param sessionCookie - An admin session holding `SYSTEM_MAINTENANCE_MODE`.
 * @returns The HTTP status and parsed body of the trigger call.
 */
async function runArchiveAbandonedDraftsCron(
    sessionCookie: string
): Promise<{ readonly status: number; readonly body: unknown }> {
    const url = `${API_URL}/api/v1/admin/cron/archive-abandoned-drafts`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            cookie: sessionCookie,
            'content-type': 'application/json'
        },
        body: '{}'
    });
    let body: unknown;
    try {
        body = await response.json();
    } catch {
        body = null;
    }
    return { status: response.status, body };
}

test.describe('HOST-07e: cron demotes HOST → USER @p0 @host @onboarding @cron', () => {
    let userIdsToCleanup: string[] = [];

    test.afterEach(async () => {
        if (userIdsToCleanup.length > 0) {
            await cleanupTestUsers(getDbPool(), userIdsToCleanup);
            userIdsToCleanup = [];
        }
    });

    test('A: single stale DRAFT → archived + role demoted to USER', async () => {
        const admin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(admin.id);
        await forceVerifyEmail(admin.id);

        const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(host.id);
        await forceVerifyEmail(host.id);

        const acc = await createAccommodation({
            ownerId: host.id,
            lifecycleState: 'DRAFT',
            slugPrefix: 'host-07e-a'
        });
        await backdateAccommodation(acc.id, 60);

        // Pre-state control: the row starts as a DRAFT and the owner holds
        // HOST. Without this the assertions below could be satisfied by a
        // fixture that never created what the cron is supposed to act on.
        const accBefore = await execSQL<{ lifecycle_state: string }>(
            'SELECT lifecycle_state FROM accommodations WHERE id = $1',
            [acc.id]
        );
        expect(accBefore[0]?.lifecycle_state, 'the accommodation must start as DRAFT').toBe(
            'DRAFT'
        );
        expect(await getUserRoles(host.id), 'the owner must start as a HOST').toContain('HOST');

        const cronResult = await runArchiveAbandonedDraftsCron(admin.sessionCookie);
        expect(
            cronResult.status >= 200 && cronResult.status < 300,
            `cron must succeed (status=${cronResult.status}, body=${JSON.stringify(cronResult.body)})`
        ).toBe(true);

        const accAfter = await execSQL<{ lifecycle_state: string }>(
            'SELECT lifecycle_state FROM accommodations WHERE id = $1',
            [acc.id]
        );
        expect(accAfter[0]?.lifecycle_state).toBe('ARCHIVED');

        // HOS-296: the cron revokes the HOST hat instead of overwriting a
        // scalar, so "demoted" means HOST is gone and the baseline USER hat
        // survives — an account is never left holding zero roles.
        const rolesAfter = await getUserRoles(host.id);
        expect(rolesAfter, 'HOST hat must be revoked on demotion').not.toContain('HOST');
        expect(rolesAfter, 'baseline USER hat must survive the demotion').toContain('USER');
    });

    test('B: stale + fresh drafts → only stale archived, role stays HOST', async () => {
        const admin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(admin.id);
        await forceVerifyEmail(admin.id);

        const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(host.id);
        await forceVerifyEmail(host.id);

        const staleAcc = await createAccommodation({
            ownerId: host.id,
            lifecycleState: 'DRAFT',
            slugPrefix: 'host-07e-b-stale'
        });
        await backdateAccommodation(staleAcc.id, 60);

        const freshAcc = await createAccommodation({
            ownerId: host.id,
            lifecycleState: 'DRAFT',
            slugPrefix: 'host-07e-b-fresh'
        });
        // No backdating — `updated_at` is NOW().

        const cronResult = await runArchiveAbandonedDraftsCron(admin.sessionCookie);
        expect(
            cronResult.status >= 200 && cronResult.status < 300,
            `cron must succeed (status=${cronResult.status}, body=${JSON.stringify(cronResult.body)})`
        ).toBe(true);

        const staleAfter = await execSQL<{ lifecycle_state: string }>(
            'SELECT lifecycle_state FROM accommodations WHERE id = $1',
            [staleAcc.id]
        );
        expect(staleAfter[0]?.lifecycle_state).toBe('ARCHIVED');

        const freshAfter = await execSQL<{ lifecycle_state: string }>(
            'SELECT lifecycle_state FROM accommodations WHERE id = $1',
            [freshAcc.id]
        );
        expect(freshAfter[0]?.lifecycle_state).toBe('DRAFT');

        const rolesAfter = await getUserRoles(host.id);
        expect(rolesAfter, 'HOST hat must remain while a non-archived draft exists').toContain(
            'HOST'
        );
    });
});
