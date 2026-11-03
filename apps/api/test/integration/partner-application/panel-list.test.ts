/** TEST:V8b:2 (soporte API) — AC:V8b:2 real database and route coverage. */
import { getDb, sql } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from '../listing-publication/publication-routes.helpers';
import {
    createPanelOwner,
    deletePanelFixtures,
    insertApplication,
    insertPartner,
    panelEmail,
    softDeletePartner
} from './panel.helpers';

const app = initApp();
const ADMIN_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PERMISSIONS = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_RESOLVE_APPLICATION];
const stateIds: string[] = [];

function email(label: string): string {
    const value = panelEmail(label);
    return value;
}

async function request(view?: string, permissions = PERMISSIONS) {
    const query = `?pageSize=100${view === undefined ? '' : `&view=${view}`}`;
    const response = await app.request(`/api/v1/admin/partner-applications${query}`, {
        headers: actorHeaders({ id: ADMIN_ID, role: RoleEnum.ADMIN, permissions })
    });
    return { status: response.status, body: (await response.json()) as PanelBody };
}

interface PanelItem {
    id: string;
    email: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
    resolvedAt: string | null;
    overdue: boolean;
    waitEndsAt: string | null;
    partner: { id: string; name: string; slug: string } | null;
}
interface PanelBody {
    success: boolean;
    data?: { items: PanelItem[] };
    error?: { code: string };
}

function itemsForEmails(body: PanelBody, emails: readonly string[]): PanelItem[] {
    const items = body.data?.items ?? [];
    return items.filter((item) => emails.includes(item.email));
}

async function setUpFixtures() {
    const p1 = email('pending-current');
    const p2 = email('pending-overdue');
    const a1 = email('approved-unclaimed');
    const a2 = email('approved-claimed');
    const a3 = email('approved-deleted');
    const r1 = email('rejected-active');
    const r2 = email('rejected-expired');
    const r3 = email('rejected-cancelled');
    const pNoOwner = await insertPartner({ ownerUserId: null });
    const owner = await createPanelOwner();
    const pOwned = await insertPartner({ ownerUserId: owner.id });
    const pDeleted = await insertPartner({ ownerUserId: null });
    const insertedIds = [
        await insertApplication({ email: p1, status: 'PENDING' }),
        await insertApplication({ email: p2, status: 'PENDING', createdDaysAgo: 8 }),
        await insertApplication({ email: a1, status: 'APPROVED', partnerId: pNoOwner.id }),
        await insertApplication({ email: a2, status: 'APPROVED', partnerId: pOwned.id }),
        await insertApplication({ email: a3, status: 'APPROVED', partnerId: pDeleted.id }),
        await insertApplication({ email: r1, status: 'REJECTED', resolvedDaysAgo: 1 }),
        await insertApplication({ email: r2, status: 'REJECTED', resolvedDaysAgo: 40 }),
        await insertApplication({
            email: r3,
            status: 'REJECTED',
            resolvedDaysAgo: 1,
            waitCancelled: true
        })
    ];
    await softDeletePartner(pDeleted.id);
    stateIds.push(...insertedIds);
    return {
        emails: { p1, p2, a1, a2, a3, r1, r2, r3 },
        partners: { pNoOwner },
        ids: {
            p1: insertedIds[0],
            p2: insertedIds[1],
            a1: insertedIds[2],
            a2: insertedIds[3],
            a3: insertedIds[4],
            r1: insertedIds[5],
            r2: insertedIds[6],
            r3: insertedIds[7]
        }
    };
}

async function readDates(
    emailValue: string
): Promise<{ readonly createdAt: string; readonly resolvedAt: string | null }> {
    const result = await getDb().execute(
        sql`SELECT created_at, resolved_at FROM partner_application WHERE email = ${emailValue}`
    );
    const row = result.rows[0];
    return {
        createdAt: new Date(row?.created_at as Date).toISOString(),
        resolvedAt: row?.resolved_at ? new Date(row.resolved_at as Date).toISOString() : null
    };
}

async function readSnapshot() {
    const result = await getDb().execute(sql`
        SELECT id, status, resolved_at, partner_id, wait_cancelled_at
        FROM partner_application WHERE id IN (${sql.join(
            stateIds.map((id) => sql`${id}::uuid`),
            sql`, `
        )}) ORDER BY id`);
    return result.rows;
}

async function assertDeadlineVersions(): Promise<void> {
    const result = await getDb().execute(sql`
        SELECT 1 FROM vertical_deadline_version
        WHERE "values" ? '8' AND "values" ? '9' LIMIT 1`);
    expect(
        result.rows,
        'Required deadline version with PLAZO:8 and PLAZO:9 is missing'
    ).toHaveLength(1);
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    await assertDeadlineVersions();
});
afterEach(async () => {
    await deletePanelFixtures();
    stateIds.splice(0);
});
afterAll(async () => testDb.teardown());

describe('TEST:V8b:2 (soporte API) partner application panel', () => {
    it('(a,b) lists pending applications in age order with the strict overdue flag and defaults to pending', async () => {
        const fixture = await setUpFixtures();
        const { emails } = fixture;
        const pendingEmails = [emails.p1, emails.p2];
        for (const view of ['pending', undefined]) {
            const response = await request(view);
            expect(response.status).toBe(200);
            const ownItems = await itemsForEmails(response.body, pendingEmails);
            expect(ownItems).toEqual([
                {
                    id: fixture.ids.p2,
                    email: emails.p2,
                    status: 'PENDING',
                    createdAt: (await readDates(emails.p2)).createdAt,
                    resolvedAt: null,
                    overdue: true,
                    waitEndsAt: null,
                    partner: null
                },
                {
                    id: fixture.ids.p1,
                    email: emails.p1,
                    status: 'PENDING',
                    createdAt: (await readDates(emails.p1)).createdAt,
                    resolvedAt: null,
                    overdue: false,
                    waitEndsAt: null,
                    partner: null
                }
            ]);
        }
    });

    it('(c,g) lists unclaimed approvals with partner identity and excludes claimed or deleted partners', async () => {
        const fixture = await setUpFixtures();
        const response = await request('approvedUnclaimed');
        expect(response.status).toBe(200);
        const ownItems = itemsForEmails(response.body, [fixture.emails.a1]);
        const dates = await readDates(fixture.emails.a1);
        expect(ownItems).toEqual([
            {
                id: fixture.ids.a1,
                email: fixture.emails.a1,
                status: 'APPROVED',
                createdAt: dates.createdAt,
                resolvedAt: dates.resolvedAt,
                overdue: false,
                waitEndsAt: null,
                partner: {
                    id: fixture.partners.pNoOwner.id,
                    name: fixture.partners.pNoOwner.name,
                    slug: fixture.partners.pNoOwner.slug
                }
            }
        ]);
        const excluded = itemsForEmails(response.body, [fixture.emails.a2, fixture.emails.a3]);
        expect(excluded).toEqual([]);
    });

    it('(d) lists only rejected applications with an active wait and derives its end from stored resolution time', async () => {
        const fixture = await setUpFixtures();
        const resolved = await getDb().execute(sql`
            SELECT pa.created_at, pa.resolved_at, pa.resolved_at + make_interval(days =>
                ((v."values" -> '9' ->> 'days')::int)
            ) AS wait_ends_at
            FROM partner_application pa
            JOIN vertical_deadline_version v ON v.version = pa.deadlines_version
            WHERE pa.email = ${fixture.emails.r1}`);
        const response = await request('rejectedWaiting');
        expect(response.status).toBe(200);
        const active = itemsForEmails(response.body, [fixture.emails.r1]);
        expect(active).toEqual([
            {
                id: fixture.ids.r1,
                email: fixture.emails.r1,
                status: 'REJECTED',
                createdAt: new Date(resolved.rows[0]?.created_at as Date).toISOString(),
                resolvedAt: new Date(resolved.rows[0]?.resolved_at as Date).toISOString(),
                overdue: false,
                waitEndsAt: new Date(resolved.rows[0]?.wait_ends_at as Date).toISOString(),
                partner: null
            }
        ]);
        const excluded = itemsForEmails(response.body, [fixture.emails.r2, fixture.emails.r3]);
        expect(excluded).toEqual([]);
    });

    it('(e) keeps all seeded applications in their original state after all views are read', async () => {
        await setUpFixtures();
        const before = await readSnapshot();
        await request('pending');
        await request('approvedUnclaimed');
        await request('rejectedWaiting');
        const after = await readSnapshot();
        expect(after).toEqual(before);
    });

    it('(f) forbids an admin without PARTNER_RESOLVE_APPLICATION', async () => {
        const response = await request('pending', [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.PARTNER_MANAGE
        ]);
        expect(response.status).toBe(403);
        expect(response.body).toEqual(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({ code: 'FORBIDDEN' })
            })
        );
    });
});
