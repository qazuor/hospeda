import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';

/** Produces a collision-resistant email address for one PP1 integration test. */
export function createApplicationEmail(): string {
    return `pp1-${randomUUID()}@example.test`;
}

/** Inserts a pending application, optionally preserving an explicit deadline version. */
export async function insertPending({
    email,
    deadlinesVersion
}: {
    readonly email: string;
    readonly deadlinesVersion?: number | null;
}): Promise<string> {
    const result = await getDb().execute(sql`
        INSERT INTO partner_application (email, status, deadlines_version)
        VALUES (
            ${email}, 'PENDING',
            ${
                deadlinesVersion === undefined
                    ? sql`(SELECT max("version") FROM "vertical_deadline_version")`
                    : sql`${deadlinesVersion}`
            }
        )
        RETURNING id`);
    return String(result.rows[0]?.id);
}

/** Reads a Partner row for assertions owned by the current test. */
export async function readPartner({ id }: { readonly id: string }) {
    const result = await getDb().execute(sql`
        SELECT id, slug, name, type, lifecycle_state, owner_user_id, claim_secret_hash
        FROM partners WHERE id = ${id}::uuid`);
    return result.rows[0];
}

/** Deletes only Partner rows created by the current test. */
export async function deletePartners({ ids }: { readonly ids: readonly string[] }): Promise<void> {
    for (const id of ids) await getDb().execute(sql`DELETE FROM partners WHERE id = ${id}::uuid`);
}

/** Inserts a rejected application with the fields written by the real PP3 transition. */
export async function insertRejected({
    email,
    resolvedDaysAgo
}: {
    readonly email: string;
    readonly resolvedDaysAgo: number;
}): Promise<string> {
    const result = await getDb().execute(sql`
        INSERT INTO partner_application (email, status, resolved_at, partner_id, deadlines_version)
        VALUES (
            ${email}, 'REJECTED', now() - (${resolvedDaysAgo} * interval '1 day'), NULL,
            (SELECT max("version") FROM "vertical_deadline_version")
        )
        RETURNING id`);
    return String(result.rows[0]?.id);
}

/** Reads only applications whose email matches the test-owned mailbox, ignoring case. */
export async function readApplications({ email }: { readonly email: string }) {
    const result = await getDb().execute(sql`
        SELECT id, email, status, partner_id, resolved_at, wait_cancelled_at, deadlines_version
        FROM partner_application WHERE lower(email) = lower(${email}) ORDER BY id`);
    return result.rows;
}

/** Deletes every application row created for one test-owned email address. */
export async function deleteApplications({ email }: { readonly email: string }): Promise<void> {
    await getDb().execute(
        sql`DELETE FROM partner_application WHERE lower(email) = lower(${email})`
    );
}

/** Inserts an approved application and an unclaimed Partner with a test-owned claim hash. */
export async function insertClaimablePartner(args: {
    readonly email: string;
    readonly hash: string;
    readonly actorId: string;
}): Promise<{ readonly partnerId: string; readonly applicationId: string }> {
    const partner = await getDb().execute(sql`
        INSERT INTO partners (slug, name, type, lifecycle_state, created_by_id, updated_by_id, claim_secret_hash)
        VALUES (${`claim-${randomUUID()}`}, 'Claim fixture', 'business', 'DRAFT', ${args.actorId}, ${args.actorId}, ${args.hash})
        RETURNING id`);
    const partnerId = String(partner.rows[0]?.id);
    const application = await getDb().execute(sql`
        INSERT INTO partner_application (email, status, resolved_at, partner_id, deadlines_version)
        VALUES (${args.email}, 'APPROVED', now(), ${partnerId}::uuid, (SELECT max(version) FROM vertical_deadline_version))
        RETURNING id`);
    return { partnerId, applicationId: String(application.rows[0]?.id) };
}
