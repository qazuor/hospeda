import type { ReadOnlyClient } from './known-ids.ts';

/**
 * Where the staging database anchors a preapproval, read once before the window's reset.
 * `payerEmails` are held in memory only: they are never printed nor written to the manifest.
 */
export interface StagingSources {
    /**
     * Preapproval ids the database stores: every `provider_link.provider_id`, plus the
     * `authorizationId` of every completed `PREAPPROVAL_CREATE` idempotency key (the attempts
     * a retry replaced, which no longer have a link).
     */
    readonly anchoredIds: readonly string[];
    /**
     * The email each subscription sent to the provider as `payer_email`:
     * `coalesce(declared_payer_email, users.email)`, the same expression the creations sweep
     * uses (`creation-sweep.model.ts`). The fallback covers rows created before migration
     * 0177 and successors created with no declared email. It is how a loose preapproval (one
     * that never got its `provider_link` row, like an abandoned checkout) is found.
     */
    readonly payerEmails: readonly string[];
}

/**
 * Every link, cancelled or not, and every preapproval id a completed creation attempt recorded:
 * whether one is still alive is decided by re-reading it by id, never by `cancelled_seen_at`
 * (the last re-read can be old).
 */
const ANCHORED_IDS_SQL = `
    SELECT provider_id AS id FROM provider_link WHERE provider_id IS NOT NULL
    UNION
    SELECT result->>'authorizationId' FROM idempotency_key
    WHERE operation = 'PREAPPROVAL_CREATE' AND result->>'authorizationId' IS NOT NULL`;

/**
 * Every payer email, in every status: an active row may still have a loose retry behind it.
 * `coalesce(declared, users.email)` as in the creations sweep; a blank declared email falls
 * back too. An account closure pseudonymizes `users.email` and clears the declared one, so a
 * closed account's loose preapprovals are found only through the anchored ids above.
 */
const PAYER_EMAILS_SQL = `
    SELECT DISTINCT btrim(coalesce(nullif(btrim(s.declared_payer_email), ''), u.email)) AS email
    FROM subscription s LEFT JOIN users u ON u.id = s.user_id
    WHERE btrim(coalesce(nullif(btrim(s.declared_payer_email), ''), u.email)) <> ''`;

function column({
    rows,
    name
}: {
    readonly rows: readonly Record<string, unknown>[];
    readonly name: string;
}): readonly string[] {
    return rows
        .map((row) => row[name])
        .filter((value): value is string => typeof value === 'string' && value.length > 0);
}

/**
 * Reads the two sources inside a READ ONLY transaction (the session is read-only by default
 * too, see `connectReadOnly`). A missing table is an error, never an empty source.
 *
 * @param input - a connected read-only client, already checked to be staging's
 * @returns the anchored ids and the declared payer emails
 */
export async function readStagingSources({
    client
}: {
    readonly client: ReadOnlyClient;
}): Promise<StagingSources> {
    await client.query('BEGIN READ ONLY');
    try {
        const anchored = await client.query(ANCHORED_IDS_SQL);
        const emails = await client.query(PAYER_EMAILS_SQL);
        return {
            anchoredIds: column({ rows: anchored.rows, name: 'id' }),
            payerEmails: column({ rows: emails.rows, name: 'email' })
        };
    } finally {
        await client.query('ROLLBACK');
    }
}
