/** TEST:V8b:2 (soporte API) — AC:V8b:2 injected-clock and fail-closed coverage. */
import { getDb, listPartnerApplicationsForPanel, sql } from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    createPanelOwner,
    deletePanelFixtures,
    insertApplication,
    insertPartner,
    panelEmail,
    softDeletePartner
} from './panel.helpers';

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

    it('(d) filters approved and rejected views by ownership, deletion, cancellation, and wait expiry', async () => {
        const owner = await createPanelOwner();
        const unclaimedPartner = await insertPartner({ ownerUserId: null });
        const claimedPartner = await insertPartner({ ownerUserId: owner.id });
        const deletedPartner = await insertPartner({ ownerUserId: null });
        const approvedEmail = email('model-approved-unclaimed');
        const claimedEmail = email('model-approved-claimed');
        const deletedEmail = email('model-approved-deleted');
        await insertApplication({
            email: approvedEmail,
            status: 'APPROVED',
            partnerId: unclaimedPartner.id
        });
        await insertApplication({
            email: claimedEmail,
            status: 'APPROVED',
            partnerId: claimedPartner.id
        });
        await insertApplication({
            email: deletedEmail,
            status: 'APPROVED',
            partnerId: deletedPartner.id
        });
        await softDeletePartner(deletedPartner.id);
        const approved = await listPartnerApplicationsForPanel({
            view: 'approvedUnclaimed',
            now: new Date(),
            page: 1,
            pageSize: 100
        });
        const unclaimed = approved.items.find((item) => item.email === approvedEmail);
        expect(unclaimed).toEqual(
            expect.objectContaining({
                status: 'APPROVED',
                partner: {
                    id: unclaimedPartner.id,
                    name: unclaimedPartner.name,
                    slug: unclaimedPartner.slug
                }
            })
        );
        expect(approved.items.some((item) => item.email === claimedEmail)).toBe(false);
        expect(approved.items.some((item) => item.email === deletedEmail)).toBe(false);

        const activeEmail = email('model-rejected-active');
        const expiredEmail = email('model-rejected-expired');
        const cancelledEmail = email('model-rejected-cancelled');
        await insertApplication({ email: activeEmail, status: 'REJECTED', resolvedDaysAgo: 1 });
        await insertApplication({ email: expiredEmail, status: 'REJECTED', resolvedDaysAgo: 40 });
        await insertApplication({
            email: cancelledEmail,
            status: 'REJECTED',
            resolvedDaysAgo: 1,
            waitCancelled: true
        });
        const rejected = await listPartnerApplicationsForPanel({
            view: 'rejectedWaiting',
            now: new Date(),
            page: 1,
            pageSize: 100
        });
        expect(rejected.items.some((item) => item.email === activeEmail)).toBe(true);
        expect(rejected.items.some((item) => item.email === expiredEmail)).toBe(false);
        expect(rejected.items.some((item) => item.email === cancelledEmail)).toBe(false);
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
