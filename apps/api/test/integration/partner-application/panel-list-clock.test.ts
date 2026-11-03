/** TEST:V8b:2 (soporte API) — AC:V8b:2 injected-clock and fail-closed coverage. */
import { getDb, listPartnerApplicationsForPanel, sql } from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { deletePanelFixtures, insertApplication, panelEmail } from './panel.helpers';

const createdEmails: string[] = [];
const DAY = 24 * 60 * 60 * 1000;

async function createdAt(email: string): Promise<Date> {
    const result = await getDb().execute(
        sql`SELECT created_at FROM partner_application WHERE email = ${email}`
    );
    return new Date(result.rows[0]?.created_at as Date);
}

async function resolvedAt(email: string): Promise<Date> {
    const result = await getDb().execute(
        sql`SELECT resolved_at FROM partner_application WHERE email = ${email}`
    );
    return new Date(result.rows[0]?.resolved_at as Date);
}

function email(label: string): string {
    const value = panelEmail(label);
    createdEmails.push(value);
    return value;
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    const versions = await getDb().execute(sql`
        SELECT 1 FROM vertical_deadline_version
        WHERE "values" ? '8' AND "values" ? '9' LIMIT 1`);
    expect(
        versions.rows,
        'Required deadline version with PLAZO:8 and PLAZO:9 is missing'
    ).toHaveLength(1);
});
afterEach(async () => {
    await deletePanelFixtures();
    createdEmails.splice(0);
});
afterAll(async () => testDb.teardown());

describe('TEST:V8b:2 (soporte API) partner application panel clock', () => {
    it('(a) uses the injected clock with a strict PLAZO:8 boundary and never resolves the row', async () => {
        const value = email('clock-pending');
        const id = await insertApplication({ email: value, status: 'PENDING' });
        const t = await createdAt(value);
        const before = await listPartnerApplicationsForPanel({
            view: 'pending',
            now: new Date(t.getTime() + 7 * DAY - 60_000),
            page: 1,
            pageSize: 100
        });
        const after = await listPartnerApplicationsForPanel({
            view: 'pending',
            now: new Date(t.getTime() + 7 * DAY + 60_000),
            page: 1,
            pageSize: 100
        });
        const exact = await listPartnerApplicationsForPanel({
            view: 'pending',
            now: new Date(t.getTime() + 7 * DAY),
            page: 1,
            pageSize: 100
        });
        expect(before.items.find((item) => item.id === id)?.overdue).toBe(false);
        expect(after.items.find((item) => item.id === id)?.overdue).toBe(true);
        expect(exact.items.find((item) => item.id === id)?.overdue).toBe(false);
        const state = await getDb().execute(
            sql`SELECT status FROM partner_application WHERE id = ${id}::uuid`
        );
        expect(state.rows).toEqual([{ status: 'PENDING' }]);
    });

    it('(b) includes an active rejection wait before its deadline and excludes it after', async () => {
        const value = email('clock-rejected');
        await insertApplication({ email: value, status: 'REJECTED' });
        const t = await resolvedAt(value);
        const before = await listPartnerApplicationsForPanel({
            view: 'rejectedWaiting',
            now: new Date(t.getTime() + 30 * DAY - 60_000),
            page: 1,
            pageSize: 100
        });
        expect(before.items.some((item) => item.email === value)).toBe(true);
        const after = await listPartnerApplicationsForPanel({
            view: 'rejectedWaiting',
            now: new Date(t.getTime() + 30 * DAY + 60_000),
            page: 1,
            pageSize: 100
        });
        expect(after.items.some((item) => item.email === value)).toBe(false);
    });

    it("(c) fails closed when a pending application's stored version has no PLAZO:8", async () => {
        const value = email('missing-deadline');
        await insertApplication({ email: value, status: 'PENDING', deadlinesVersion: 999999 });
        await expect(
            listPartnerApplicationsForPanel({
                view: 'pending',
                now: new Date(),
                page: 1,
                pageSize: 100
            })
        ).rejects.toThrow(/PLAZO:8/);
    });
});
