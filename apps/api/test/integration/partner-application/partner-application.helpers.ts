import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';

/** Produces a collision-resistant email address for one PP1 integration test. */
export function createApplicationEmail(): string {
    return `pp1-${randomUUID()}@example.test`;
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
