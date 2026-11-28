import { type SQL, sql } from 'drizzle-orm';
import { qrCodes } from '../../schemas/qr-code/qr_code.dbschema.ts';
import { qrCodeTags } from '../../schemas/qr-code/qr_code_tag.dbschema.ts';
import { rQrCodeQrCodeTag } from '../../schemas/qr-code/r_qr_code_qr_code_tag.dbschema.ts';

/**
 * SQL conditions for the two admin QR list filters that are not columns
 * (HOS-2679). Kept in `@repo/db` so the service never spells table SQL itself.
 *
 * @module models/qr-code/qrCode.filters
 */

/**
 * The raw (still percent-encoded) value of the FIRST `utm_campaign` param in
 * `qr_codes.target_url`, or `NULL`.
 *
 * - `split_part(..., '#', 1)` drops the fragment first, so `#x&utm_campaign=y`
 *   is not mistaken for a query param.
 * - `regexp_match` answers the LEFTMOST match, which is the first occurrence —
 *   the same one `readUtmParams` (and `URLSearchParams.get`) reads.
 * - The `'i'` flag matches the key case-insensitively, as `readUtmParams` does.
 *
 * The value is NOT decoded here: SQL has no `decodeURIComponent`. Callers compare
 * against the encoded spellings ({@link buildQrCodeUtmCampaignCondition}) or
 * decode in JS ({@link QrCodeModel.findDistinctRawUtmCampaigns}).
 */
export const QR_CODE_RAW_UTM_CAMPAIGN_SQL: SQL<string | null> = sql<
    string | null
>`(regexp_match(split_part(${qrCodes.targetUrl}, '#', 1), '[?&]utm_campaign=([^&]*)', 'i'))[1]`;

/**
 * Codes whose stored `utm_campaign` is exactly one of `encodedValues`.
 *
 * Exact on purpose — `verano` must not match `verano-2025` — and over the
 * ENCODED spellings because the column holds the URL as written: the caller
 * passes every spelling a value may be stored under (`verano%202026`,
 * `verano+2026`, ...).
 *
 * @param input.encodedValues - Non-empty list of encoded spellings to accept.
 * @returns The SQL condition.
 */
export function buildQrCodeUtmCampaignCondition(input: {
    readonly encodedValues: readonly string[];
}): SQL {
    const values = input.encodedValues.map((value) => sql`${value}`);
    return sql`${QR_CODE_RAW_UTM_CAMPAIGN_SQL} in (${sql.join(values, sql`, `)})`;
}

/**
 * Codes carrying ANY of `tagIds`, counting live tags only — a soft-deleted tag
 * keeps its join rows but must stop matching.
 *
 * @param input.tagIds - Non-empty list of tag ids.
 * @returns The SQL condition.
 */
export function buildQrCodeTagFilterCondition(input: { readonly tagIds: readonly string[] }): SQL {
    const ids = input.tagIds.map((id) => sql`${id}`);
    return sql`exists (select 1 from ${rQrCodeQrCodeTag} inner join ${qrCodeTags} on ${qrCodeTags.id} = ${rQrCodeQrCodeTag.qrCodeTagId} where ${rQrCodeQrCodeTag.qrCodeId} = ${qrCodes.id} and ${qrCodeTags.deletedAt} is null and ${rQrCodeQrCodeTag.qrCodeTagId} in (${sql.join(ids, sql`, `)}))`;
}
