import type { ReadOnlyClient } from './known-ids.ts';

/**
 * Where the staging database anchors a preapproval, read once before the window's reset.
 * `payerEmails` are held in memory only: they are never printed nor written to the manifest.
 */
export interface StagingSources {
    /** `provider_link.provider_id`: the preapproval id of every linked subscription. */
    readonly anchoredIds: readonly string[];
    /**
     * `subscription.declared_payer_email`: the email sent to the provider as `payer_email`
     * when the authorization was created. It is how a loose preapproval (one that never got
     * its `provider_link` row, like an abandoned checkout) is found.
     */
    readonly payerEmails: readonly string[];
}

/**
 * Every link, cancelled or not: whether one is still alive is decided by re-reading it by id,
 * never by `cancelled_seen_at` (the last re-read can be old).
 */
const ANCHORED_IDS_SQL = `
    SELECT DISTINCT provider_id AS id FROM provider_link WHERE provider_id IS NOT NULL`;

/** Every declared email, in every status: an active row may still have a loose retry behind it. */
const PAYER_EMAILS_SQL = `
    SELECT DISTINCT btrim(declared_payer_email) AS email FROM subscription
    WHERE declared_payer_email IS NOT NULL AND btrim(declared_payer_email) <> ''`;

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
