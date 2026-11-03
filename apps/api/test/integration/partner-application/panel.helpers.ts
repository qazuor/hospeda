/** TEST:V8b:2 (soporte API) — AC:V8b:2 panel fixtures and scoped cleanup. */
import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { createOwner } from '../listing-publication/publication-routes.helpers';

const applicationIds: string[] = [];
const partnerIds: string[] = [];
const userIds: string[] = [];

/** Creates and tracks a user used by this panel test file. */
export async function createPanelOwner(): Promise<{ readonly id: string; readonly email: string }> {
    const owner = await createOwner({ email: `panel-owner-${randomUUID()}@example.test` });
    userIds.push(owner.id);
    return owner;
}

/** Creates a uniquely named Partner and tracks it for scoped cleanup. */
export async function insertPartner(input: { readonly ownerUserId: string | null }): Promise<{
    readonly id: string;
    readonly name: string;
    readonly slug: string;
}> {
    const id = randomUUID();
    const name = `Panel Partner ${id}`;
    const slug = `panel-partner-${id}`;
    await getDb().execute(sql`
        INSERT INTO partners (id, slug, name, type, owner_user_id)
        VALUES (${id}::uuid, ${slug}, ${name}, 'business', ${input.ownerUserId}::uuid)`);
    partnerIds.push(id);
    return { id, name, slug };
}

/** Inserts an application matching the production writer's state invariants. */
export async function insertApplication(input: {
    readonly email: string;
    readonly status: 'PENDING' | 'APPROVED' | 'REJECTED';
    readonly createdDaysAgo?: number;
    readonly resolvedDaysAgo?: number;
    readonly partnerId?: string;
    readonly waitCancelled?: boolean;
    readonly deadlinesVersion?: number;
}): Promise<string> {
    let cancellationUserId: string | null = null;
    if (input.waitCancelled) {
        const user = await createPanelOwner();
        cancellationUserId = user.id;
    }
    const deadlineVersion =
        input.deadlinesVersion === undefined
            ? sql`(SELECT max(version) FROM vertical_deadline_version)`
            : sql`${input.deadlinesVersion}::int`;
    const result = await getDb().execute(sql`
        INSERT INTO partner_application (
            email, status, created_at, resolved_at, partner_id,
            wait_cancelled_at, wait_cancelled_by, deadlines_version
        ) VALUES (
            ${input.email},
            ${input.status},
            now() - (${input.createdDaysAgo ?? 0} * interval '1 day'),
            ${input.status === 'PENDING' ? null : sql`now() - (${input.resolvedDaysAgo ?? 0} * interval '1 day')`},
            ${input.status === 'APPROVED' ? (input.partnerId ?? null) : null}::uuid,
            ${input.waitCancelled ? sql`now()` : null},
            ${cancellationUserId}::uuid,
            ${deadlineVersion}
        ) RETURNING id`);
    const id = String(result.rows[0]?.id);
    applicationIds.push(id);
    return id;
}

/** Marks a tracked Partner soft-deleted. */
export async function softDeletePartner(id: string): Promise<void> {
    await getDb().execute(sql`UPDATE partners SET deleted_at = now() WHERE id = ${id}::uuid`);
}

/** Removes only fixtures created by the panel integration tests in foreign-key order. */
export async function deletePanelFixtures(): Promise<void> {
    const db = getDb();
    for (const id of applicationIds.splice(0)) {
        await db.execute(sql`DELETE FROM partner_application WHERE id = ${id}::uuid`);
    }
    for (const id of partnerIds.splice(0)) {
        await db.execute(sql`DELETE FROM partners WHERE id = ${id}::uuid`);
    }
    for (const id of userIds.splice(0)) {
        await db.execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    }
}

/** Creates a unique email address for one panel fixture. */
export function panelEmail(label: string): string {
    return `v8b-panel-${label}-${randomUUID()}@example.test`;
}
