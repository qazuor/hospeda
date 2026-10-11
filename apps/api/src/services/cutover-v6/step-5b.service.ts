import type { DrizzleClient } from '@repo/db';
import { sql } from '@repo/db';
import { extractPublicId } from '@repo/media';
import type { CalendarGrantRevoker, DecryptSecret, PassageRow, PhotoStorage } from './ports.js';
import { passageRowSchema } from './ports.js';

const PASSAGE_TABLE = 'cutover_v6_deleted_listing';
const GOOGLE_PROVIDER = 'GOOGLE_CALENDAR';

/** Result for one failed external action, containing no credential or URL data. */
export interface Step5bFailure {
    readonly entityType: PassageRow['entityType'];
    readonly entityId: string;
    readonly item: string;
    readonly errorClass: string;
}

/** Counts and listing identifiers produced by step 5b. */
export interface Step5bResult {
    readonly status: 'already_done' | 'completed' | 'partial' | 'dry_run';
    readonly deleted: number;
    readonly alreadyAbsent: number;
    readonly unmanaged: number;
    readonly revoked: number;
    readonly alreadyInvalid: number;
    readonly notRevocable: number;
    readonly providerFallback: number;
    readonly failures: readonly Step5bFailure[];
    readonly listings: readonly {
        readonly entityType: PassageRow['entityType'];
        readonly entityId: string;
    }[];
}

/** Dependencies for {@link runStep5b}. */
export interface RunStep5bInput {
    readonly db: DrizzleClient;
    readonly photoStorage: PhotoStorage;
    readonly grantRevoker: CalendarGrantRevoker;
    readonly decryptSecret: DecryptSecret;
    readonly dryRun: boolean;
}

/**
 * Removes remote photos and closes Google grants recorded by migration 0148.
 * The passage table is deliberately outside the Drizzle schema because the
 * cutover SQL owns its lifecycle and drops it after successful completion.
 *
 * @param input - Database, remote ports, vault decoder, and dry-run option.
 * @returns Secret-free progress and aggregate counts.
 */
export async function runStep5b(input: RunStep5bInput): Promise<Step5bResult> {
    const { db, dryRun } = input;
    const existsResult = await db.execute(
        sql`SELECT to_regclass('public.cutover_v6_deleted_listing')::text AS table_name`
    );
    const existsRows = rowsOf<{ table_name: string | null }>(existsResult);
    if (existsRows[0]?.table_name == null) return emptyResult('already_done');

    const readResult = await db.execute(sql`
        SELECT entity_type AS "entityType", entity_id::text AS "entityId", slug,
            photos, calendar_tokens AS "calendarTokens"
        FROM ${sql.raw(PASSAGE_TABLE)}
        ORDER BY entity_type, entity_id
    `);
    const passageRows = passageRowSchema.array().parse(rowsOf<unknown>(readResult));
    const counts = {
        deleted: 0,
        alreadyAbsent: 0,
        unmanaged: 0,
        revoked: 0,
        alreadyInvalid: 0,
        notRevocable: 0,
        providerFallback: 0
    };
    const failures: Step5bFailure[] = [];
    const listings: { entityType: PassageRow['entityType']; entityId: string }[] = [];

    for (const listing of passageRows) {
        listings.push({ entityType: listing.entityType, entityId: listing.entityId });
        let listingFailed = false;

        for (const [index, photo] of listing.photos.entries()) {
            const publicId = photo.publicId ?? extractPublicId(photo.url);
            if (publicId === null) {
                counts.unmanaged += 1;
                continue;
            }
            if (dryRun) {
                counts.deleted += 1;
                continue;
            }
            try {
                const result = await input.photoStorage.delete({ publicId });
                if (result.wasPresent) counts.deleted += 1;
                else counts.alreadyAbsent += 1;
            } catch (error) {
                listingFailed = true;
                failures.push(failureFor({ listing, item: `photo:${index}`, error }));
            }
        }

        for (const [index, calendarToken] of listing.calendarTokens.entries()) {
            const provider = calendarToken.provider;
            let isGoogle: boolean;
            if (provider === undefined || provider === null) {
                counts.providerFallback += 1;
                isGoogle =
                    calendarToken.refresh_token_ciphertext !== null ||
                    calendarToken.external_calendar_id !== null;
            } else {
                isGoogle = provider === GOOGLE_PROVIDER;
            }
            if (!isGoogle) {
                counts.notRevocable += 1;
                continue;
            }
            const secret = secretFor(calendarToken);
            if (secret === null) {
                listingFailed = true;
                failures.push(
                    failureFor({
                        listing,
                        item: `calendar:${index}`,
                        error: new Error('MissingEncryptedSecret')
                    })
                );
                continue;
            }
            if (dryRun) {
                counts.revoked += 1;
                continue;
            }
            try {
                const { plaintext } = input.decryptSecret(secret);
                const result = await input.grantRevoker.revoke({ token: plaintext });
                if (result === 'revoked') counts.revoked += 1;
                else counts.alreadyInvalid += 1;
            } catch (error) {
                listingFailed = true;
                failures.push(failureFor({ listing, item: `calendar:${index}`, error }));
            }
        }

        if (!dryRun && !listingFailed) {
            await db.execute(sql`DELETE FROM ${sql.raw(PASSAGE_TABLE)}
                WHERE entity_type = ${listing.entityType} AND entity_id = ${listing.entityId}::uuid`);
        }
    }

    if (dryRun) return { status: 'dry_run', ...counts, failures, listings };
    if (failures.length > 0) return { status: 'partial', ...counts, failures, listings };
    await db.execute(sql`DROP TABLE ${sql.raw(PASSAGE_TABLE)}`);
    return { status: 'completed', ...counts, failures, listings };
}

function rowsOf<T>(value: unknown): T[] {
    if (Array.isArray(value)) return value as T[];
    if (typeof value === 'object' && value !== null && 'rows' in value) {
        const rows = value.rows;
        if (Array.isArray(rows)) return rows as T[];
    }
    return [];
}

function secretFor(grant: PassageRow['calendarTokens'][number]) {
    const refresh = {
        ciphertext: grant.refresh_token_ciphertext,
        iv: grant.refresh_token_iv,
        authTag: grant.refresh_token_auth_tag
    };
    if (refresh.ciphertext !== null && refresh.iv !== null && refresh.authTag !== null) {
        return {
            ciphertext: refresh.ciphertext,
            iv: refresh.iv,
            authTag: refresh.authTag
        };
    }
    const access = {
        ciphertext: grant.access_token_ciphertext,
        iv: grant.access_token_iv,
        authTag: grant.access_token_auth_tag
    };
    if (access.ciphertext !== null && access.iv !== null && access.authTag !== null) {
        return {
            ciphertext: access.ciphertext,
            iv: access.iv,
            authTag: access.authTag
        };
    }
    return null;
}

function failureFor(input: {
    readonly listing: PassageRow;
    readonly item: string;
    readonly error: unknown;
}): Step5bFailure {
    return {
        entityType: input.listing.entityType,
        entityId: input.listing.entityId,
        item: input.item,
        errorClass: input.error instanceof Error ? input.error.name : 'UnknownError'
    };
}

function emptyResult(status: 'already_done'): Step5bResult {
    return {
        status,
        deleted: 0,
        alreadyAbsent: 0,
        unmanaged: 0,
        revoked: 0,
        alreadyInvalid: 0,
        notRevocable: 0,
        providerFallback: 0,
        failures: [],
        listings: []
    };
}
