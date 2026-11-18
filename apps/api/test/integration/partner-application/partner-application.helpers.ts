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
        SELECT id, slug, name, type, type_id, lifecycle_state, owner_user_id, claim_secret_hash, claim_email
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

/** Catalog rows the approval tests rely on, keyed by slug (HOS-2336). */
const TEST_PARTNER_TYPES = {
    business: { es: 'Comercio', en: 'Business', pt: 'Comércio', weight: 10 },
    media: { es: 'Medio', en: 'Media outlet', pt: 'Meio de comunicação', weight: 40 }
} as const;

/** A partner type slug {@link ensureTestPartnerType} can provide. */
export type TestPartnerTypeSlug = keyof typeof TEST_PARTNER_TYPES;

const ensuredPartnerTypeIds = new Map<TestPartnerTypeSlug, string>();

/**
 * Makes sure the ACTIVE catalog row for `slug` exists and returns ITS id.
 *
 * The integration database is built by migrations only, so the rows the seed
 * would provide may be missing; another suite may also have created them with
 * a different id. Upserting on the slug and reading the id back is the only
 * answer that is right in both cases. Shared by every file that approves an
 * application or creates a partner (both require `typeId`).
 *
 * @param input - The slug to ensure, `business` by default.
 * @returns The catalog id of that type.
 */
export async function ensureTestPartnerType({
    slug = 'business'
}: {
    readonly slug?: TestPartnerTypeSlug;
} = {}): Promise<string> {
    const row = TEST_PARTNER_TYPES[slug];
    const nameI18n = JSON.stringify({ es: row.es, en: row.en, pt: row.pt });
    const result = await getDb().execute(sql`
        INSERT INTO partner_types (slug, name_i18n, display_weight, lifecycle_state)
        VALUES (${slug}, ${nameI18n}::jsonb, ${row.weight}, 'ACTIVE')
        ON CONFLICT (slug) DO UPDATE
            SET lifecycle_state = 'ACTIVE', deleted_at = NULL, updated_at = now()
        RETURNING id`);
    const id = String(result.rows[0]?.id);
    ensuredPartnerTypeIds.set(slug, id);
    return id;
}

/**
 * The id {@link ensureTestPartnerType} returned for `slug` in this file.
 *
 * @param input - The slug, `business` by default.
 * @returns The catalog id.
 * @throws When the type was not ensured first (a `beforeAll` is missing).
 */
export function testPartnerTypeId({
    slug = 'business'
}: {
    readonly slug?: TestPartnerTypeSlug;
} = {}): string {
    const id = ensuredPartnerTypeIds.get(slug);
    if (!id) throw new Error(`ensureTestPartnerType({ slug: '${slug}' }) must run first`);
    return id;
}
