/**
 * HOST-07e — Cron demotes HOST → USER after the last DRAFT is archived.
 *
 * Actors: HOST owning only DRAFT accommodations + the
 *         `archive-abandoned-drafts` cron job.
 * Tags: @p0 @host @onboarding @cron
 *
 * Preconditions:
 *   - `HOSPEDA_CRON_SECRET` set on the API (read at runtime by the
 *     cron-execution endpoint).
 *   - `archive-abandoned-drafts` job registered and reachable via
 *     `POST /api/v1/cron/archive-abandoned-drafts`.
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
import { backdateAccommodation, execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const CRON_SECRET = process.env.HOSPEDA_CRON_SECRET ?? '';

async function runArchiveAbandonedDraftsCron(): Promise<{
    readonly status: number;
    readonly body: unknown;
}> {
    const url = `${API_URL}/api/v1/cron/archive-abandoned-drafts`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'x-cron-secret': CRON_SECRET,
            'content-type': 'application/json'
        }
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
        if (!CRON_SECRET) {
            test.fixme(true, 'HOSPEDA_CRON_SECRET not set in test env — cannot trigger cron');
            return;
        }

        const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(host.id);
        await forceVerifyEmail(host.id);

        const acc = await createAccommodation({
            ownerId: host.id,
            lifecycleState: 'DRAFT',
            slugPrefix: 'host-07e-a'
        });
        await backdateAccommodation(acc.id, 60);

        const cronResult = await runArchiveAbandonedDraftsCron();
        expect(
            cronResult.status >= 200 && cronResult.status < 300,
            `cron must succeed (status=${cronResult.status}, body=${JSON.stringify(cronResult.body)})`
        ).toBe(true);

        const accAfter = await execSQL<{ lifecycle_state: string }>(
            'SELECT lifecycle_state FROM accommodations WHERE id = $1',
            [acc.id]
        );
        expect(accAfter[0]?.lifecycle_state).toBe('ARCHIVED');

        const userAfter = await execSQL<{ role: string }>('SELECT role FROM users WHERE id = $1', [
            host.id
        ]);
        expect(userAfter[0]?.role, 'role must be demoted to USER').toBe('USER');
    });

    test('B: stale + fresh drafts → only stale archived, role stays HOST', async () => {
        if (!CRON_SECRET) {
            test.fixme(true, 'HOSPEDA_CRON_SECRET not set in test env — cannot trigger cron');
            return;
        }

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

        const cronResult = await runArchiveAbandonedDraftsCron();
        expect(
            cronResult.status >= 200 && cronResult.status < 300,
            `cron must succeed (status=${cronResult.status})`
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

        const userAfter = await execSQL<{ role: string }>('SELECT role FROM users WHERE id = $1', [
            host.id
        ]);
        expect(userAfter[0]?.role, 'role must remain HOST while a non-archived draft exists').toBe(
            'HOST'
        );
    });
});
